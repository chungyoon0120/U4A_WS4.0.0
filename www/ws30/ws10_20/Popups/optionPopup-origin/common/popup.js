/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * optionPopup 공통 토스트, 확인창, 입력 팝업 UI를 제공한다.
 *
 */
(function (global) {
    "use strict";

    const MSG = {
        CANCEL: ["ZMSG_WS_COMMON_001", "003"],
        CONFIRM: ["ZMSG_WS_COMMON_001", "002"],
        SAVE: ["ZMSG_WS_COMMON_001", "315"]
    };

    function msgText(cls, no) {

        const oAPP = global.OptionPopupUtil?.getApp?.();
        const aParams = Array.prototype.slice.call(arguments, 2);
        const sMissingText = cls && no ? `${cls} ${no}` : "";

        if (!cls || !no) {
            return "";
        }

        if (typeof oAPP?.common?.fnGetMsgClsText !== "function") {
            return sMissingText;
        }

        try {
            return oAPP.common.fnGetMsgClsText(
                cls,
                no,
                aParams[0] || "",
                aParams[1] || "",
                aParams[2] || "",
                aParams[3] || ""
            ) || sMissingText;
        } catch (error) {
            return sMissingText;
        }

    }

    function text(key) {

        const aMsg = MSG[key];

        if (!aMsg) {
            return key || "";
        }

        return msgText.apply(null, aMsg);

    }

    function injectStyle() {

        if (document.getElementById("op-popup-style")) {
            return;
        }

        const oStyle = document.createElement("style");
        oStyle.id = "op-popup-style";
        oStyle.textContent = `
            .op-toast-stack {
                position: fixed;
                top: 50%;
                left: 50%;
                z-index: 99980;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                width: min(420px, calc(100vw - 40px));
                transform: translate(-50%, -50%);
                pointer-events: none;
            }
            .op-toast {
                width: 100%;
                min-width: min(280px, 100%);
                padding: 14px 18px;
                border: 1px solid var(--opt-primary-color);
                border-radius: 4px;
                background: var(--opt-modal-bg, var(--opt-toast-bg));
                color: var(--opt-title-color, var(--opt-toast-text));
                box-shadow: var(--opt-modal-shadow);
                font-size: 13px;
                font-weight: 700;
                line-height: 1.55;
                text-align: center;
                white-space: pre-line;
                word-break: keep-all;
            }
            .op-dialog-backdrop {
                position: fixed;
                inset: 0;
                z-index: 99990;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: var(--opt-overlay-bg);
            }
            .op-dialog {
                width: min(420px, 100%);
                border: 1px solid var(--opt-border-color);
                border-radius: 6px;
                background: var(--opt-modal-bg);
                box-shadow: var(--opt-modal-shadow);
                color: var(--opt-text-color);
                font-family: "72", "72full", Arial, "Malgun Gothic", sans-serif;
            }
            .op-dialog__header {
                padding: 12px 16px 10px;
                border-bottom: 1px solid var(--opt-border-soft-color);
                background: var(--opt-modal-header-bg);
                color: var(--opt-title-color, var(--opt-text-color));
                font-size: 13px;
                font-weight: 700;
            }
            .op-dialog__body {
                padding: 14px 16px;
                font-size: 13px;
                line-height: 1.55;
            }
            .op-dialog__message {
                padding: 6px 4px;
                color: var(--opt-title-color, var(--opt-text-color));
                font-size: 14px;
                font-weight: 700;
                line-height: 1.6;
                text-align: center;
                white-space: pre-line;
                word-break: keep-all;
            }
            .op-dialog__input {
                width: 100%;
                height: 30px;
                margin-top: 10px;
                padding: 0 9px;
                border: 1px solid var(--opt-input-border);
                border-radius: 4px;
                background: var(--opt-input-bg);
                color: var(--opt-text-color);
                font: inherit;
                outline: none;
            }
            .op-dialog__input:focus {
                border-color: var(--opt-primary-color);
                box-shadow: var(--opt-focus-shadow);
            }
            .op-dialog__input.is-error {
                border-color: #e54b4b;
                box-shadow: 0 0 0 2px rgba(229, 75, 75, .18);
            }
            .op-dialog__field-error {
                display: none;
                margin-top: 8px;
                color: #ff8a8a;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.4;
                word-break: keep-all;
            }
            .op-dialog__field-error.is-visible {
                display: block;
            }
            .op-dialog__footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 10px 16px 12px;
            }
            .op-dialog--message .op-dialog__footer {
                justify-content: center;
            }
            .op-dialog__button {
                min-width: 74px;
                height: 30px;
                padding: 0 12px;
                border: 1px solid var(--opt-input-border);
                border-radius: 4px;
                background: var(--opt-button-bg);
                color: var(--opt-text-color);
                font: inherit;
                cursor: pointer;
            }
            .op-dialog__button:hover {
                background: var(--opt-button-hover-bg);
            }
            .op-dialog__button:active {
                background: var(--opt-button-active-bg);
            }
            .op-dialog__button--primary {
                border-color: var(--opt-primary-color);
                background: var(--opt-primary-color);
                color: #fff;
            }
            .op-dialog__button--primary:hover {
                background: var(--opt-primary-hover-color);
            }
        `;

        document.head.appendChild(oStyle);

    }

    function getToastStack() {

        injectStyle();

        let oStack = document.querySelector(".op-toast-stack");

        if (oStack) {
            return oStack;
        }

        oStack = document.createElement("div");
        oStack.className = "op-toast-stack";
        document.body.appendChild(oStack);

        return oStack;

    }

    function clearToasts() {

        document.querySelectorAll(".op-toast").forEach(function (node) {
            node.remove();
        });

    }

    function toast(message, duration) {

        clearToasts();

        const oToast = document.createElement("div");
        oToast.className = "op-toast";
        oToast.textContent = message || "";

        getToastStack().appendChild(oToast);

        setTimeout(function () {
            oToast.remove();
        }, duration || 3200);

    }

    function closeOpenDialogs() {

        document.querySelectorAll(".op-dialog-backdrop").forEach(function (node) {
            node.remove();
        });

    }

    function createDialog(options) {

        injectStyle();
        closeOpenDialogs();

        const oBackdrop = document.createElement("div");
        oBackdrop.className = "op-dialog-backdrop";

        const oDialog = document.createElement("div");
        oDialog.className = "op-dialog";
        oDialog.setAttribute("role", "dialog");
        oDialog.setAttribute("aria-modal", "true");

        if (options.message) {
            oDialog.classList.add("op-dialog--message");
        }

        const oHeader = document.createElement("div");
        oHeader.className = "op-dialog__header";
        oHeader.textContent = options.title || text("CONFIRM");

        const oBody = document.createElement("div");
        oBody.className = "op-dialog__body";

        if (options.message) {
            const oMessage = document.createElement("div");
            oMessage.className = "op-dialog__message";
            oMessage.textContent = options.message;
            oBody.appendChild(oMessage);
        }

        const oFooter = document.createElement("div");
        oFooter.className = "op-dialog__footer";

        oDialog.appendChild(oHeader);
        oDialog.appendChild(oBody);
        oDialog.appendChild(oFooter);
        oBackdrop.appendChild(oDialog);
        document.body.appendChild(oBackdrop);

        return {
            backdrop: oBackdrop,
            dialog: oDialog,
            body: oBody,
            footer: oFooter,
            close: function () {
                oBackdrop.remove();
            }
        };

    }

    function makeButton(text, primary) {

        const oButton = document.createElement("button");
        oButton.type = "button";
        oButton.className = "op-dialog__button";
        oButton.textContent = text;

        if (primary) {
            oButton.classList.add("op-dialog__button--primary");
        }

        return oButton;

    }

    function confirm(options) {

        return new Promise(function (resolve) {

            const oUi = createDialog(options || {});
            const sCancelText = typeof options?.cancelText === "string" ? options.cancelText : text("CANCEL");
            const oCancel = sCancelText ? makeButton(sCancelText, false) : null;
            const oOk = makeButton(options?.okText || text("CONFIRM"), true);

            if (oCancel) {
                oCancel.addEventListener("click", function () {
                    oUi.close();
                    resolve(false);
                });
            }

            oOk.addEventListener("click", function () {
                oUi.close();
                resolve(true);
            });

            if (options?.primaryFirst !== false) {
                oUi.footer.appendChild(oOk);
                if (oCancel) {
                    oUi.footer.appendChild(oCancel);
                }
            } else {
                if (oCancel) {
                    oUi.footer.appendChild(oCancel);
                }
                oUi.footer.appendChild(oOk);
            }
            oOk.focus();

        });

    }

    function prompt(options) {

        return new Promise(function (resolve) {

            const oUi = createDialog(options || {});
            const oInput = document.createElement("input");
            oInput.className = "op-dialog__input";
            oInput.type = "text";
            oInput.value = options?.value || "";
            oInput.placeholder = options?.placeholder || "";

            const iMaxLength = Number(options?.maxLength);
            if (Number.isFinite(iMaxLength) && iMaxLength > 0) {
                oInput.maxLength = Math.floor(iMaxLength);
            }

            oUi.body.appendChild(oInput);

            const oError = document.createElement("div");
            oError.className = "op-dialog__field-error";
            oUi.body.appendChild(oError);

            function clearError() {
                oInput.classList.remove("is-error");
                oInput.removeAttribute("aria-invalid");
                oError.classList.remove("is-visible");
                oError.textContent = "";
            }

            function showError(message) {
                oInput.classList.add("is-error");
                oInput.setAttribute("aria-invalid", "true");
                oError.textContent = message || "";
                oError.classList.add("is-visible");
                oInput.focus();
                oInput.select();
            }

            const oCancel = makeButton(options?.cancelText || text("CANCEL"), false);
            const oOk = makeButton(options?.okText || text("SAVE"), true);

            oCancel.addEventListener("click", function () {
                oUi.close();
                resolve(null);
            });

            oOk.addEventListener("click", function () {
                const sValue = oInput.value.trim();
                const sError = typeof options?.validate === "function" ? options.validate(sValue, oInput.value) : "";

                if (sError) {
                    showError(sError);
                    return;
                }

                oUi.close();
                resolve(sValue);
            });

            oInput.addEventListener("input", clearError);

            oInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    oOk.click();
                }
            });

            if (options?.primaryFirst !== false) {
                oUi.footer.appendChild(oOk);
                oUi.footer.appendChild(oCancel);
            } else {
                oUi.footer.appendChild(oCancel);
                oUi.footer.appendChild(oOk);
            }
            oInput.focus();
            oInput.select();

        });

    }

    function message(messageText, title) {

        return confirm({
            title: title || text("CONFIRM"),
            message: messageText || "",
            okText: text("CONFIRM"),
            cancelText: ""
        });

    }

    global.OptionPopupPopup = {
        ensureStyle: injectStyle,
        createDialog,
        makeButton,
        toast,
        confirm,
        prompt,
        message
    };

})(window);
