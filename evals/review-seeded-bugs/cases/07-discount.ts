export interface Customer {
  id: string;
  birthDate: Date;
  isMember: boolean;
}

/**
 * Senior discount: customers aged 65 or older get 15% off.
 * Members get an extra 5% on top. Age is computed on the purchase date.
 */
export function discountRate(customer: Customer, purchaseDate: Date): number {
  const age = ageOn(customer.birthDate, purchaseDate);
  let rate = 0;
  if (age > 65) {
    rate += 0.15;
  }
  if (customer.isMember) {
    rate += 0.05;
  }
  return rate;
}

function ageOn(birth: Date, on: Date): number {
  let age = on.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    on.getMonth() < birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
