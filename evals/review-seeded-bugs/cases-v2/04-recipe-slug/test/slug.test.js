const { slugify } = require("../src/slug");

test("plain titles", () => {
  expect(slugify("Beef Stew")).toBe("beef-stew");
});

test("accented titles keep their letters", () => {
  expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  expect(slugify("Jalapeño Poppers")).toBe("jalapeno-poppers");
});

test("trims separators", () => {
  expect(slugify("  -Pho- ")).toBe("pho");
});
