// Paginate a list of orders for the account history page.
// Pages are 1-based; pageSize defaults to 20.
function paginate(items, page = 1, pageSize = 20) {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page must be a positive integer");
  }
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return {
    page,
    totalPages,
    hasNext: page < totalPages,
    items: items.slice(start, end),
  };
}

module.exports = { paginate };
