import puppeteer from 'puppeteer';
import fs from 'fs';
import { findFiles } from '@jam-do/jam-tools/node/findFiles.js';

let cases = findFiles('./', ['ref.htm'], ['node_modules']);
