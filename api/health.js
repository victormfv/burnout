module.exports = async (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
};