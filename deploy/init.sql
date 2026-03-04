CREATE TYPE container_status AS ENUM (
    'UNKNOWN',
    'PENDING',
    'RUNNING',
    'STOPPED',
    'ERROR'
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    surname VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    balance INTEGER DEFAULT 0,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(50) NOT NULL,
    cpu_cores INT NOT NULL,
    ram INT NOT NULL,
    disk_space INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS containers (
    container_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    cpu INT NOT NULL,
    ram INT NOT NULL,
    disk INT NOT NULL,
    ip_address VARCHAR(45),
    status container_status NOT NULL DEFAULT 'UNKNOWN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_node FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS port_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id UUID NOT NULL,
    host_port INT NOT NULL,
    container_port INT NOT NULL,
    protocol VARCHAR(10) NOT NULL DEFAULT 'tcp',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_container FOREIGN KEY (container_id) REFERENCES containers(container_id) ON DELETE CASCADE,
    CONSTRAINT unique_host_port UNIQUE (host_port)
);

CREATE INDEX idx_port_mappings_container ON port_mappings(container_id);
CREATE INDEX idx_port_mappings_host_port ON port_mappings(host_port);
