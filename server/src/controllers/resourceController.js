import Resource from '../models/Resource.js';

// GET /api/resources?department=BMO
// Returns active resources for a department (or all), rooms first by floor then
// equipment. The client splits these by `kind` to drive the Reserve form.
export async function listResources(req, res) {
  const filter = { active: true };
  if (req.query.department) filter.department = req.query.department;
  if (req.query.kind) filter.kind = req.query.kind;
  const resources = await Resource.find(filter).sort({ kind: 1, floor: 1, name: 1 });
  res.json(resources);
}

// GET /api/resources/catalog
// Returns, per department: rooms grouped by floor, plus the equipment list.
export async function getCatalog(req, res) {
  const resources = await Resource.find({ active: true });
  const tree = {};
  for (const r of resources) {
    tree[r.department] ??= { floors: {}, equipment: [] };
    if (r.kind === 'room') {
      (tree[r.department].floors[r.floor] ??= []).push(r.name);
    } else {
      tree[r.department].equipment.push(r.name);
    }
  }
  res.json(tree);
}
