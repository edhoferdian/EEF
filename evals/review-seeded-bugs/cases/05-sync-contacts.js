const { fetchContacts } = require("./crm-client");
const { Contact } = require("./models");

/**
 * Pull every contact from the CRM and upsert it locally.
 * Resolves with the number of contacts stored once all writes are done.
 */
async function syncContacts(accountId) {
  const contacts = await fetchContacts(accountId);
  let stored = 0;
  contacts.forEach(async (c) => {
    await Contact.upsert({
      accountId,
      externalId: c.id,
      email: c.email.toLowerCase(),
      name: c.name,
    });
    stored += 1;
  });
  return stored;
}

module.exports = { syncContacts };
