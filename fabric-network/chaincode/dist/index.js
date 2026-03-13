"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const accessControl_1 = require("./accessControl");
const audit_1 = require("./audit");
const record_1 = require("./record");
const contracts = [accessControl_1.AccessControlContract, audit_1.AuditContract, record_1.RecordContract];
exports.contracts = contracts;
