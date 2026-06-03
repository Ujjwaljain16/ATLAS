"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TRANSITIONS = exports.FSMState = void 0;
var FSMState;
(function (FSMState) {
    FSMState["INIT"] = "INIT";
    FSMState["VALIDATE_GOAL"] = "VALIDATE_GOAL";
    FSMState["LAUNCH_BROWSER"] = "LAUNCH_BROWSER";
    FSMState["NAVIGATE"] = "NAVIGATE";
    FSMState["OBSERVE"] = "OBSERVE";
    FSMState["PLAN"] = "PLAN";
    FSMState["ACT"] = "ACT";
    FSMState["VALIDATE"] = "VALIDATE";
    FSMState["RECOVER"] = "RECOVER";
    FSMState["COMPLETE"] = "COMPLETE";
    FSMState["TEARDOWN"] = "TEARDOWN";
    FSMState["FAILED"] = "FAILED";
})(FSMState || (exports.FSMState = FSMState = {}));
exports.VALID_TRANSITIONS = {
    [FSMState.INIT]: [FSMState.VALIDATE_GOAL, FSMState.FAILED],
    [FSMState.VALIDATE_GOAL]: [FSMState.LAUNCH_BROWSER, FSMState.FAILED],
    [FSMState.LAUNCH_BROWSER]: [FSMState.NAVIGATE, FSMState.FAILED],
    [FSMState.NAVIGATE]: [FSMState.OBSERVE, FSMState.RECOVER, FSMState.FAILED],
    [FSMState.OBSERVE]: [FSMState.PLAN, FSMState.RECOVER, FSMState.FAILED],
    [FSMState.PLAN]: [FSMState.ACT, FSMState.RECOVER, FSMState.FAILED],
    [FSMState.ACT]: [FSMState.VALIDATE, FSMState.RECOVER, FSMState.FAILED],
    [FSMState.VALIDATE]: [FSMState.OBSERVE, FSMState.COMPLETE, FSMState.RECOVER],
    [FSMState.RECOVER]: [FSMState.OBSERVE, FSMState.FAILED],
    [FSMState.COMPLETE]: [FSMState.TEARDOWN],
    [FSMState.TEARDOWN]: [],
    [FSMState.FAILED]: [FSMState.TEARDOWN],
};
