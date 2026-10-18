"use strict";

const LLM_CONFIG = require("../src/llmConfig");
const UzbekTokenizer = require("../src/uzbekTokenizer");

// We will test updating transformerModel with the full backward pass
// and verifying that blocks[0].W_q, blocks[0].W_f1, blocks[1].W_o all change!
