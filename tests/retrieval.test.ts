import { test } from "node:test";
import assert from "node:assert/strict";
import { rankDocuments, stem, tokenize } from "../src/lib/retrieval.ts";

test("stem collapses common word forms", () => {
  assert.equal(stem("cooking"), stem("cooked"));
  assert.equal(stem("stories"), "story");
  assert.equal(stem("farms"), "farm");
});

test("tokenize drops stopwords and punctuation", () => {
  assert.deepEqual(tokenize("Tell me about the farm, Grandpa!"), ["farm", "grandpa"]);
});

test("ranks the most relevant memory first", () => {
  const docs = [
    { id: "a", text: "My first job was at the steel mill in Hamilton. Long shifts, good friends." },
    { id: "b", text: "Every summer we stayed at my grandmother's farm and I learned to milk the cows." },
    { id: "c", text: "I met your grandmother at a dance in 1968. She stepped on my foot." },
  ];
  const r = rankDocuments("What was the farm like in summer?", docs);
  assert.equal(r[0].doc.id, "b");
  assert.ok(!r.some((x) => x.doc.id === "a"));
});

test("weight boosts a document", () => {
  const docs = [
    { id: "raw", text: "dance music", weight: 1 },
    { id: "mem", text: "dance music", weight: 2 },
  ];
  assert.equal(rankDocuments("dance", docs)[0].doc.id, "mem");
});

test("returns nothing for empty queries or corpora", () => {
  assert.deepEqual(rankDocuments("the and of", [{ id: "x", text: "farm" }]), []);
  assert.deepEqual(rankDocuments("farm", []), []);
});
