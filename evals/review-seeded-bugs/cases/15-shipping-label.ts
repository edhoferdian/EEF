export interface Address {
  city: string;
  country: string;
}

export interface User {
  id: string;
  name: string;
  // Filled in during onboarding; brand-new accounts don't have it yet.
  address?: Address;
}

export function shippingLabel(user: User): string {
  const { city, country } = user.address!;
  return `${user.name}\n${city}, ${country}`;
}

export function greeting(user: User): string {
  return user.address ? `Hi ${user.name} from ${user.address.city}` : `Hi ${user.name}`;
}
