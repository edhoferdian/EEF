export const config = {
  shipping: {
    baseUrl: process.env.SHIPPING_API_URL ?? "https://api.shipper.example",
    timeout: 10, // seconds
  },
  tax: {
    baseUrl: process.env.TAX_API_URL ?? "https://api.tax.example",
    timeout: 5, // seconds
  },
};
