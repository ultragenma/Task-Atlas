const DEFAULT_URI = "http://127.0.0.1:7474/db/neo4j/tx/commit";

function syncEndpoint() {
  const uri = process.env.NEO4J_HTTP_URL || DEFAULT_URI;
  return uri.endsWith("/tx/commit") ? uri : `${uri.replace(/\/$/, "")}/tx/commit`;
}

async function syncSeedGraph(data) {
  if (process.env.GRAPH_STORE !== "neo4j") return { enabled: false, synced: false };
  const nodes = [];
  const add = (items, type) => items.forEach((item) => nodes.push({ id: item.id, type, properties: item }));
  add(data.objects, "Object"); add(data.scenes, "Scene"); add(data.tasks, "Task");
  add(data.intents, "Intent"); add(data.skills, "Skill"); add(data.claims, "Claim");
  add(data.evidence, "Evidence"); add(data.expansionLoops, "ExpansionLoop");
  const relations = data.expansionRelations.map((item) => ({ source: item.source, target: item.target, type: item.relation, properties: item }));
  const statements = [
    { statement: "UNWIND $nodes AS n MERGE (x:AtlasNode {id:n.id}) SET x.type=n.type, x += n.properties", parameters: { nodes } },
    { statement: "UNWIND $relations AS r MATCH (a:AtlasNode {id:r.source}), (b:AtlasNode {id:r.target}) MERGE (a)-[e:RELATED {type:r.type}]->(b) SET e += r.properties", parameters: { relations } },
  ];
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "taskatlas";
  const response = await fetch(syncEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` },
    body: JSON.stringify({ statements }),
  });
  if (!response.ok) throw new Error(`Neo4j sync failed (${response.status})`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));
  return { enabled: true, synced: true, nodes: nodes.length, relations: relations.length };
}

module.exports = { syncSeedGraph };
