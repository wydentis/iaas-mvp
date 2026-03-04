export const calculatePrice = (specs, billingPeriod = 'hour') => {
  const hourlyRates = {
    cpu: 0.48,
    ram: 0.25,
    disk: 0.05,
    backup: 0.25,
    publicIP: 0.25,
    bandwidth: 1.0,
    nvme: 0.75
  };

  let hourlyPrice = 0;
  
  if (specs.cpu) hourlyPrice += specs.cpu * hourlyRates.cpu;
  if (specs.ram) hourlyPrice += (specs.ram / 1024) * hourlyRates.ram;
  if (specs.disk) hourlyPrice += (specs.disk / 50) * hourlyRates.disk;
  if (specs.nvme) hourlyPrice += hourlyRates.nvme;
  if (specs.backup) hourlyPrice += hourlyRates.backup;
  if (specs.publicIP) hourlyPrice += hourlyRates.publicIP;
  if (specs.bandwidth) hourlyPrice += (specs.bandwidth / 1000) * hourlyRates.bandwidth;

  const prices = {
    hour: hourlyPrice,
    day: hourlyPrice * 24,
    month: hourlyPrice * 24 * 30
  };

  return prices[billingPeriod] || hourlyPrice;
};

export const formatPrice = (price) => {
  return `${price.toFixed(2)} ₽`;
};

export const getDiscountText = () => {
  return 'Скидки до 10% — при пополнении на несколько месяцев';
};
