// Return a plain object containing only the listed attributes of a Sequelize
// instance (or of an already-plain object). Used by the controllers to keep
// internal columns such as `passwordHash` out of API responses.
const pick = (instance, attrs) => {
  const data =
    instance && typeof instance.get === 'function'
      ? instance.get({ plain: true })
      : instance;

  return attrs.reduce((acc, key) => {
    acc[key] = data[key];
    return acc;
  }, {});
};

module.exports = { pick };
