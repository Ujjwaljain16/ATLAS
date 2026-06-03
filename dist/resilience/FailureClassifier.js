"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailureClassifier = void 0;
class FailureClassifier {
    classify(error) {
        const errorStr = typeof error === 'string' ? error : error.code;
        // Browser-level failures
        if (errorStr.includes('BROWSER_CRASH'))
            return this.fatal('BROWSER', 'NONE');
        if (errorStr.includes('LAUNCH_TIMEOUT'))
            return this.recoverable('BROWSER', 'RESTART');
        // Network failures
        if (errorStr.includes('NET_ERR') ||
            errorStr.includes('DNS_FAIL'))
            return this.transient('NETWORK', 'RETRY');
        if (errorStr.includes('HTTP_5'))
            return this.transient('NETWORK', 'RETRY');
        if (errorStr.includes('HTTP_4'))
            return this.fatal('NETWORK', 'NONE');
        // Element failures
        if (errorStr.includes('ELEMENT_NOT_FOUND'))
            return this.recoverable('ELEMENT', 'AUTO');
        if (errorStr.includes('ELEMENT_HIDDEN'))
            return this.recoverable('ELEMENT', 'AUTO');
        if (errorStr.includes('ELEMENT_DISABLED'))
            return this.recoverable('ELEMENT', 'AUTO');
        if (errorStr.includes('STALE_ELEMENT'))
            return this.transient('ELEMENT', 'RETRY');
        // Page failures
        if (errorStr.includes('NAV_TIMEOUT'))
            return this.transient('PAGE', 'RETRY');
        if (errorStr.includes('PAGE_NOT_READY'))
            return this.transient('PAGE', 'RETRY');
        // Default: transient
        return this.transient('PAGE', 'RETRY');
    }
    transient(source, recoverability) {
        return { severity: 'TRANSIENT', source, recoverability };
    }
    recoverable(source, recoverability) {
        return { severity: 'RECOVERABLE', source, recoverability };
    }
    fatal(source, recoverability) {
        return { severity: 'FATAL', source, recoverability };
    }
}
exports.FailureClassifier = FailureClassifier;
