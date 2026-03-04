import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import { calculatePrice, formatPrice, getDiscountText } from '../../utils/pricing';
import './CreateServer.css';

const OS_IMAGES = [
  { id: 'ubuntu', name: 'Ubuntu', icon: '🟣', versions: ['24.04', '22.04', '20.04'] },
  { id: 'debian', name: 'Debian', icon: '🔴', versions: ['13', '12', '11'] },
  { id: 'centos', name: 'CentOS', icon: '🟡', versions: ['10', '9', '8'] },
  { id: 'bitrix', name: 'BitrixVM + CentOS', icon: '🔴', versions: ['9'] },
  { id: 'windows', name: 'Windows Server', icon: '🔵', versions: ['2022', '2019'] },
  { id: 'almalinux', name: 'AlmaLinux', icon: '🟣', versions: ['10.0', '9.0'] }
];

export const CreateServer = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nodes, setNodes] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('hour');
  
  const [config, setConfig] = useState({
    name: '',
    os: null,
    osVersion: '',
    region: null,
    cpu: 1,
    ram: 1024,
    disk: 15,
    nvme: false,
    bandwidth: 1000,
    backup: false,
    publicIP: false,
    start_script: ''
  });

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const { data } = await api.get('/nodes');
      setNodes(data);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  const requestAIRecommendation = async () => {
    const prompt = `Мне нужен сервер для веб-приложения`;
    try {
      const { data } = await api.post('/ai/hardware-recommendation', { text: prompt });
      setAiRecommendations(data);
    } catch (error) {
      console.error('Failed to get AI recommendations:', error);
    }
  };

  const applyRecommendation = (tier) => {
    const rec = aiRecommendations[tier];
    setConfig({
      ...config,
      cpu: rec.cpu_cores,
      ram: rec.ram_gb * 1024,
      disk: rec.disk_size_gb
    });
  };

  const handleCreate = async () => {
    try {
      const payload = {
        name: config.name || 'My Server',
        node_id: config.region.node_id,
        image: `${config.os.id}:${config.osVersion}`,
        cpu: config.cpu,
        ram: config.ram,
        disk: config.disk,
        start_script: config.start_script
      };

      await api.post('/vps', payload);
      navigate('/');
    } catch (error) {
      console.error('Failed to create server:', error);
      alert(error.response?.data?.error || 'Ошибка создания сервера');
    }
  };

  const renderOSStep = () => (
    <div className="create-step">
      <div className="step-header">
        <button onClick={() => navigate('/')} className="back-btn">← Назад</button>
        <h2>1. Образ</h2>
      </div>

      <div className="os-tabs">
        <button className="tab-active">Операционные системы</button>
        <button>Маркетплейс</button>
        <button>Мои образы</button>
      </div>

      <div className="os-grid">
        {OS_IMAGES.map(os => (
          <div key={os.id} className="os-card">
            <div className="os-header">
              <span className="os-icon">{os.icon}</span>
              <span>{os.name}</span>
            </div>
            <select
              value={config.os?.id === os.id ? config.osVersion : ''}
              onChange={(e) => {
                setConfig({ ...config, os, osVersion: e.target.value });
              }}
              className="version-select"
            >
              <option value="">Выбрать версию</option>
              {os.versions.map(v => (
                <option key={v} value={v}>Версия {v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="step-actions">
        <Button onClick={() => setStep(2)} disabled={!config.os || !config.osVersion}>
          Далее: Регион →
        </Button>
      </div>
    </div>
  );

  const renderRegionStep = () => (
    <div className="create-step">
      <div className="step-header">
        <button onClick={() => setStep(1)} className="back-btn">← Назад</button>
        <h2>2. Регион</h2>
      </div>

      <div className="region-grid">
        {nodes.map(node => (
          <div
            key={node.node_id}
            className={`region-card ${config.region?.node_id === node.node_id ? 'selected' : ''}`}
            onClick={() => setConfig({ ...config, region: node })}
          >
            <div className="region-header">
              <span className="region-flag">🇷🇺</span>
              <span className="region-name">{node.name}</span>
              <span className="region-status">{node.status === 'active' ? '✓ Доступен' : 'Недоступен'}</span>
            </div>
            <div className="region-location">{node.ip_address}</div>
          </div>
        ))}
      </div>

      <div className="step-actions">
        <Button onClick={() => setStep(3)} disabled={!config.region}>
          Далее: Конфигурация →
        </Button>
      </div>
    </div>
  );

  const renderConfigStep = () => {
    const price = calculatePrice({
      cpu: config.cpu,
      ram: config.ram,
      disk: config.disk,
      nvme: config.nvme,
      backup: config.backup,
      publicIP: config.publicIP,
      bandwidth: config.bandwidth
    }, billingPeriod);

    return (
      <div className="create-step">
        <div className="step-header">
          <button onClick={() => setStep(2)} className="back-btn">← Назад</button>
          <h2>3. Конфигурация</h2>
        </div>

        <div className="config-layout">
          <div className="config-main">
            <div className="config-tabs">
              <button className="tab-active">Фиксированная</button>
              <button>Произвольная</button>
            </div>

            {!aiRecommendations && (
              <Button onClick={requestAIRecommendation} variant="outline">
                Спросить у ИИ рекомендацию
              </Button>
            )}

            {aiRecommendations && (
              <div className="ai-recommendations">
                <h4>Рекомендации ИИ:</h4>
                <div className="recommendation-grid">
                  {['basic_minimum', 'optimal', 'luxury_maximum'].map(tier => {
                    const rec = aiRecommendations[tier];
                    const tierNames = {
                      basic_minimum: 'Минимальная',
                      optimal: 'Оптимальная',
                      luxury_maximum: 'Максимальная'
                    };
                    return (
                      <div key={tier} className="recommendation-card" onClick={() => applyRecommendation(tier)}>
                        <h5>{tierNames[tier]}</h5>
                        <p>CPU: {rec.cpu_cores} ядер</p>
                        <p>RAM: {rec.ram_gb} ГБ</p>
                        <p>Диск: {rec.disk_size_gb} ГБ</p>
                        <small>{rec.reasoning}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="config-options">
              <div className="config-item">
                <label>CPU: {config.cpu} × 3.3 ГГц</label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={config.cpu}
                  onChange={(e) => setConfig({ ...config, cpu: parseInt(e.target.value) })}
                />
              </div>

              <div className="config-item">
                <label>RAM: {(config.ram / 1024).toFixed(0)} ГБ</label>
                <input
                  type="range"
                  min="1024"
                  max="32768"
                  step="1024"
                  value={config.ram}
                  onChange={(e) => setConfig({ ...config, ram: parseInt(e.target.value) })}
                />
              </div>

              <div className="config-item">
                <label>NVMe: {config.disk} ГБ</label>
                <input
                  type="range"
                  min="15"
                  max="500"
                  step="5"
                  value={config.disk}
                  onChange={(e) => setConfig({ ...config, disk: parseInt(e.target.value) })}
                />
              </div>

              <div className="config-item">
                <label>Интернет-канал: {config.bandwidth} Мбит/с</label>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={config.bandwidth}
                  onChange={(e) => setConfig({ ...config, bandwidth: parseInt(e.target.value) })}
                />
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={config.backup}
                    onChange={(e) => setConfig({ ...config, backup: e.target.checked })}
                  />
                  Бэкапы (0.25 ₽/час)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={config.publicIP}
                    onChange={(e) => setConfig({ ...config, publicIP: e.target.checked })}
                  />
                  Публичный IP (0.25 ₽/час)
                </label>
              </div>
            </div>
          </div>

          <div className="config-sidebar">
            <div className="price-card">
              <h3>Цена</h3>
              
              <div className="billing-tabs">
                <button
                  className={billingPeriod === 'hour' ? 'active' : ''}
                  onClick={() => setBillingPeriod('hour')}
                >
                  Час
                </button>
                <button
                  className={billingPeriod === 'day' ? 'active' : ''}
                  onClick={() => setBillingPeriod('day')}
                >
                  День
                </button>
                <button
                  className={billingPeriod === 'month' ? 'active' : ''}
                  onClick={() => setBillingPeriod('month')}
                >
                  Мес
                </button>
              </div>

              <div className="price-details">
                <div className="price-row">
                  <span>ОС</span>
                  <span>{config.os?.name} {config.osVersion}</span>
                </div>
                <div className="price-row">
                  <span>Регион</span>
                  <span>{config.region?.name}</span>
                </div>
                <div className="price-row">
                  <span>CPU</span>
                  <span>{config.cpu} × 3.3 ГГц</span>
                </div>
                <div className="price-row">
                  <span>RAM</span>
                  <span>{(config.ram / 1024).toFixed(0)} ГБ</span>
                </div>
                <div className="price-row">
                  <span>NVMe</span>
                  <span>{config.disk} ГБ</span>
                </div>
                <div className="price-row">
                  <span>Интернет-канал</span>
                  <span>{config.bandwidth} Мбит/с</span>
                </div>
                {config.backup && (
                  <div className="price-row">
                    <span>Бэкапы</span>
                    <span>{formatPrice(calculatePrice({ backup: true }, billingPeriod))}</span>
                  </div>
                )}
                {config.publicIP && (
                  <div className="price-row">
                    <span>Публичный IP</span>
                    <span>{formatPrice(calculatePrice({ publicIP: true }, billingPeriod))}</span>
                  </div>
                )}
                <div className="price-row">
                  <span>Количество серверов</span>
                  <span>1</span>
                </div>
              </div>

              <div className="price-total">
                <span>Итого</span>
                <span className="total-amount">{formatPrice(price)}/{billingPeriod === 'hour' ? 'час' : billingPeriod === 'day' ? 'день' : 'мес'}</span>
              </div>

              <Button onClick={handleCreate} size="large">
                Заказать
              </Button>

              <p className="discount-text">{getDiscountText()}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="create-server">
      <div className="steps-indicator">
        <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
        <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
        <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
        <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
        <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
      </div>

      {step === 1 && renderOSStep()}
      {step === 2 && renderRegionStep()}
      {step === 3 && renderConfigStep()}
    </div>
  );
};
