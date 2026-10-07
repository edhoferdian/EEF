function label(u) {
  if (u) {
    if (u.active) {
      if (u.admin) {
        return 'admin';
      } else {
        return 'user';
      }
    } else {
      return 'inactive';
    }
  } else {
    return 'guest';
  }
}

module.exports = { label };
