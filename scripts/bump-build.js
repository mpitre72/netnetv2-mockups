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
  if (!seq) return 'A';
  const chars = seq.toUpperCase().split('');
  let carry = 1;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (!carry) break;
    const code = chars[i].charCodeAt(0) - 65 + carry;
    if (code >= 26) {
      chars[i] = 'A';
      carry = 1;
    } else {
      chars[i] = String.fromCharCode(65 + code);
      carry = 0;
    }
  }
  if (carry) chars.unshift('A');
  return chars.join('');
}

function parseBuildInfo(contents) {
  const dateMatch = contents.match(/BUILD_DATE\s*=\s*'(\d{4}-\d{2}-\d{2})'/);
  const seqMatch = contents.match(/BUILD_SEQ\s*=\s*'([A-Z]+)'/);
  return {
    date: dateMatch ? dateMatch[1] : null,
    seq: seqMatch ? seqMatch[1] : null,
  };
}

const fileContents = fs.readFileSync(buildFile, 'utf8');
const { date: currentDate, seq: currentSeq } = parseBuildInfo(fileContents);
const today = getToday();

let nextDate = currentDate || today;
let nextSequence = currentSeq || 'A';

if (currentDate !== today) {
  nextDate = today;
  nextSequence = 'A';
} else {
  nextSequence = nextSeq(currentSeq);
}

const updated = fileContents
  .replace(/BUILD_DATE\s*=\s*'\d{4}-\d{2}-\d{2}'/, `BUILD_DATE = '${nextDate}'`)
  .replace(/BUILD_SEQ\s*=\s*'[A-Z]+'/, `BUILD_SEQ = '${nextSequence}'`);

fs.writeFileSync(buildFile, updated, 'utf8');
console.log(`[build] ${nextDate}-${nextSequence}`);
