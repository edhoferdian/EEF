// Slice a sorted list of audit events into a 1-based page.
function pageOf(events, page = 1, pageSize = 50) {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array");
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError("pageSize must be an integer between 1 and 500");
  }
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const start = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    hasNext: page < totalPages,
    events: events.slice(start, start + pageSize),
  };
}

module.exports = { pageOf };
