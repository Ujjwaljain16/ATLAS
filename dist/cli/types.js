"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskInputSchema = void 0;
const zod_1 = require("zod");
exports.TaskInputSchema = zod_1.z.object({
    goal: zod_1.z.string(),
    url: zod_1.z.string().url(),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
