// PATCH /api/me — let a signed-in user edit their own profile.
const express = require("express");
const { User } = require("./models");

const router = express.Router();

router.patch("/api/me", async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  if (!user) return res.status(401).end();

  Object.assign(user, req.body);
  await user.save();

  res.json({ id: user.id, name: user.name, email: user.email });
});

module.exports = router;
