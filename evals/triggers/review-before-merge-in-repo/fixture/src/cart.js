function total(items) {
  let sum = 0;
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price * items[i].qty;
  }
  return sum;
}

function applyCoupon(total, coupon) {
  if (coupon.type === 'percent') return total - total * coupon.value / 100;
  return total - coupon.value;
}

module.exports = { total, applyCoupon };
