const sequelize = require('../db');

// Promotes the user matching process.env.ADMIN_EMAIL (if set) to the
// 'admin' role. Runs once on every startup - idempotent, safe to call
// repeatedly. This is deliberately the *only* way to create the *first*
// admin: there is no self-service "become admin" endpoint, and there
// shouldn't be one. To bootstrap an admin, set ADMIN_EMAIL in .env to their
// (already registered) account email and restart the backend. Further
// admins are then created by that admin via PATCH /api/users/:id.
//
// Note this only ever promotes. Clearing ADMIN_EMAIL does not demote anyone;
// use PATCH /api/users/:id for that.
const ensureAdminRole = async ({ userModel } = {}) => {
  // Emails are stored as the user typed them at registration, so match
  // case-insensitively - otherwise ADMIN_EMAIL=Foo@bar.de silently fails to
  // find the account registered as foo@bar.de.
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) return;

  const resolvedUserModel = userModel || sequelize.models.user;
  const user = await resolvedUserModel.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), adminEmail),
  });
  if (!user) {
    console.warn(`[ADMIN BOOTSTRAP] No user found for ADMIN_EMAIL=${adminEmail} (register that account first)`);
    return;
  }

  if (user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
    console.log(`[ADMIN BOOTSTRAP] Promoted ${adminEmail} to admin`);
  }
};

module.exports = { ensureAdminRole };
