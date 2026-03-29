#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const buildFile = path.join(root, 'build-info.js');

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextSeq(seq) {
  if (!seq) return 'a';
  const normalized = String(seq).trim().toLowerCase();
  const lastChar = normalized[normalized.length - 1] || 'a';
  if (lastChar === 'z') {
    return 'a'.repeat(normalized.length + 1);
  }
  const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  return nextChar.repeat(normalized.length);
}

function parseBuildInfo(contents) {
  const dateMatch = contents.match(/BUILD_DATE\s*=\s*'(\d{4}-\d{2}-\d{2})'/);
  const seqMatch = contents.match(/BUILD_SEQ\s*=\s*'([A-Za-z]+)'/);
  return {
    date: dateMatch ? dateMatch[1] : null,
    seq: seqMatch ? seqMatch[1].toLowerCase() : null,
  };
}

const fileContents = fs.readFileSync(buildFile, 'utf8');
const { date: currentDate, seq: currentSeq } = parseBuildInfo(fileContents);
const today = getToday();

let nextDate = currentDate || today;
let nextSequence = currentSeq || 'a';

if (currentDate !== today) {
  nextDate = today;
  nextSequence = 'a';
} else {
  nextSequence = nextSeq(currentSeq);
}

const updated = fileContents
  .replace(/BUILD_DATE\s*=\s*'\d{4}-\d{2}-\d{2}'/, `BUILD_DATE = '${nextDate}'`)
  .replace(/BUILD_SEQ\s*=\s*'[A-Za-z]+'/, `BUILD_SEQ = '${nextSequence}'`);

fs.writeFileSync(buildFile, updated, 'utf8');
console.log(`[build] ${nextDate}-${nextSequence}`);
