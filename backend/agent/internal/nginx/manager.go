package nginx

import (
"errors"
"fmt"
"os"
"path/filepath"
"sync"
"text/template"

"github.com/google/uuid"
)

const (
DefaultConfigDir      = "/etc/nginx/stream.d"
DefaultPortRangeStart = 10000
DefaultPortRangeEnd   = 65000
NginxTemplateContent  = `# Port mappings for container {{.ContainerID}}
{{range .Mappings}}
upstream {{$.ContainerID}}_{{.HostPort}} {
    server {{$.ContainerIP}}:{{.ContainerPort}};
}

server {
    listen {{.HostPort}};
    proxy_pass {{$.ContainerID}}_{{.HostPort}};
    proxy_timeout 300s;
    proxy_connect_timeout 10s;
}
{{end}}
`
)

type PortMapping struct {
ID            string
ContainerID   string
HostPort      int32
ContainerPort int32
Protocol      string
}

type ContainerConfig struct {
ContainerID string
ContainerIP string
Mappings    []*PortMapping
}

type Manager struct {
mu             sync.RWMutex
configDir      string
portMappings   map[string]*PortMapping
containerPorts map[string][]string
usedPorts      map[int32]bool
template       *template.Template
}

func NewManager(configDir string) (*Manager, error) {
if configDir == "" {
configDir = DefaultConfigDir
}

tmpl, err := template.New("nginx").Parse(NginxTemplateContent)
if err != nil {
return nil, err
}

if err := os.MkdirAll(configDir, 0755); err != nil {
return nil, err
}

return &Manager{
configDir:      configDir,
portMappings:   make(map[string]*PortMapping),
containerPorts: make(map[string][]string),
usedPorts:      make(map[int32]bool),
template:       tmpl,
}, nil
}

func (m *Manager) CreatePortMapping(containerID, containerIP string, containerPort, hostPort int32, protocol string) (string, int32, error) {
m.mu.Lock()
defer m.mu.Unlock()

if hostPort == 0 {
var err error
hostPort, err = m.findAvailablePort()
if err != nil {
return "", 0, err
}
} else {
if m.usedPorts[hostPort] {
return "", 0, errors.New("port already in use")
}
}

mappingID := uuid.New().String()
pm := &PortMapping{
ID:            mappingID,
ContainerID:   containerID,
HostPort:      hostPort,
ContainerPort: containerPort,
Protocol:      protocol,
}

m.portMappings[mappingID] = pm
m.containerPorts[containerID] = append(m.containerPorts[containerID], mappingID)
m.usedPorts[hostPort] = true

if err := m.regenerateConfig(containerID, containerIP); err != nil {
delete(m.portMappings, mappingID)
delete(m.usedPorts, hostPort)
m.removeFromContainerPorts(containerID, mappingID)
return "", 0, err
}

return mappingID, hostPort, nil
}

func (m *Manager) GetPortMappings(containerID string) []*PortMapping {
m.mu.RLock()
defer m.mu.RUnlock()

mappingIDs := m.containerPorts[containerID]
result := make([]*PortMapping, 0, len(mappingIDs))

for _, id := range mappingIDs {
if pm, ok := m.portMappings[id]; ok {
result = append(result, pm)
}
}

return result
}

func (m *Manager) UpdatePortMapping(containerID, containerIP, mappingID string, newHostPort, newContainerPort int32) error {
m.mu.Lock()
defer m.mu.Unlock()

pm, ok := m.portMappings[mappingID]
if !ok {
return errors.New("mapping not found")
}

if pm.ContainerID != containerID {
return errors.New("mapping does not belong to this container")
}

if newHostPort != pm.HostPort {
if m.usedPorts[newHostPort] {
return errors.New("port already in use")
}
delete(m.usedPorts, pm.HostPort)
m.usedPorts[newHostPort] = true
}

pm.HostPort = newHostPort
pm.ContainerPort = newContainerPort

return m.regenerateConfig(containerID, containerIP)
}

func (m *Manager) DeletePortMapping(containerID, containerIP, mappingID string) error {
m.mu.Lock()
defer m.mu.Unlock()

pm, ok := m.portMappings[mappingID]
if !ok {
return errors.New("mapping not found")
}

if pm.ContainerID != containerID {
return errors.New("mapping does not belong to this container")
}

delete(m.portMappings, mappingID)
delete(m.usedPorts, pm.HostPort)
m.removeFromContainerPorts(containerID, mappingID)

return m.regenerateConfig(containerID, containerIP)
}

func (m *Manager) CleanupContainer(containerID string) error {
m.mu.Lock()
defer m.mu.Unlock()

mappingIDs := m.containerPorts[containerID]
for _, id := range mappingIDs {
if pm, ok := m.portMappings[id]; ok {
delete(m.usedPorts, pm.HostPort)
delete(m.portMappings, id)
}
}
delete(m.containerPorts, containerID)

configPath := filepath.Join(m.configDir, fmt.Sprintf("container_%s.conf", containerID))
if err := os.Remove(configPath); err != nil && !os.IsNotExist(err) {
return err
}

return m.reloadNginx()
}

func (m *Manager) findAvailablePort() (int32, error) {
for port := int32(DefaultPortRangeStart); port <= int32(DefaultPortRangeEnd); port++ {
if !m.usedPorts[port] {
return port, nil
}
}
return 0, errors.New("no available ports")
}

func (m *Manager) removeFromContainerPorts(containerID, mappingID string) {
ids := m.containerPorts[containerID]
for i, id := range ids {
if id == mappingID {
m.containerPorts[containerID] = append(ids[:i], ids[i+1:]...)
break
}
}
}

func (m *Manager) regenerateConfig(containerID, containerIP string) error {
mappingIDs := m.containerPorts[containerID]
mappings := make([]*PortMapping, 0, len(mappingIDs))

for _, id := range mappingIDs {
if pm, ok := m.portMappings[id]; ok {
mappings = append(mappings, pm)
}
}

configPath := filepath.Join(m.configDir, fmt.Sprintf("container_%s.conf", containerID))

if len(mappings) == 0 {
if err := os.Remove(configPath); err != nil && !os.IsNotExist(err) {
return err
}
return m.reloadNginx()
}

data := ContainerConfig{
ContainerID: containerID,
ContainerIP: containerIP,
Mappings:    mappings,
}

tmpPath := configPath + ".tmp"
f, err := os.Create(tmpPath)
if err != nil {
return err
}

if err := m.template.Execute(f, data); err != nil {
f.Close()
os.Remove(tmpPath)
return err
}
f.Close()

if err := os.Rename(tmpPath, configPath); err != nil {
os.Remove(tmpPath)
return err
}

return m.reloadNginx()
}

func (m *Manager) reloadNginx() error {
// Skip nginx reload for testing
return nil
}
