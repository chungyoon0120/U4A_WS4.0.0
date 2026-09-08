/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * optionPopup 공통 유틸리티로 경로, 파일, 테마, 메시지, 도움말 처리를 담당한다.
 *
 */
(function (global) {
    "use strict";

    const DEFAULT_THEME = {
        THEME: "sap_horizon",
        BGCOL: "#f5f6f7"
    };

    const HELP_WLO_CHGOBJ = "UHAK901435";
    const HELP_DOCUMENT_OPEN_PRCCD = "U4A_HELP_DOCUMENT_OPEN";
    const oHelpAvailabilityCache = {};

    const THEME_BACKGROUND = {
        sap_belize: "#fafafa",
        sap_belize_plus: "#fafafa",
        sap_fiori_3: "#f7f7f7",
        sap_fiori_3_dark: "#12171c",
        sap_horizon: "#f5f6f7",
        sap_horizon_dark: "#12171c"
    };

    const THEME_VARIABLES = {
        light: {
            "--opt-bg-color": "#f5f6f7",
            "--opt-panel-color": "#ffffff",
            "--opt-header-color": "#f7fafd",
            "--opt-content-color": "#f5f6f7",
            "--opt-menu-color": "#eef3f8",
            "--opt-border-color": "#c6d0dc",
            "--opt-border-soft-color": "#d9e2ec",
            "--opt-text-color": "#1d2d3e",
            "--opt-title-color": "#10283f",
            "--opt-muted-text-color": "#5f6f80",
            "--opt-primary-color": "#0070f2",
            "--opt-primary-hover-color": "#0057d2",
            "--opt-primary-soft-color": "#d1e8ff",
            "--opt-button-bg": "#ffffff",
            "--opt-button-hover-bg": "#edf5ff",
            "--opt-button-active-bg": "#dceeff",
            "--opt-input-bg": "#ffffff",
            "--opt-input-border": "#9fb3c8",
            "--opt-focus-shadow": "0 0 0 2px rgba(0, 112, 242, .18)",
            "--opt-menu-hover-bg": "#e5f1ff",
            "--opt-menu-active-bg": "#d8ecff",
            "--opt-menu-active-text": "#004b8d",
            "--opt-scrollbar-track": "#e8eef5",
            "--opt-scrollbar-thumb": "#93a6ba",
            "--opt-scrollbar-thumb-hover": "#6f8297",
            "--opt-overlay-bg": "rgba(15, 23, 42, .38)",
            "--opt-modal-bg": "#ffffff",
            "--opt-modal-header-bg": "#f7fafd",
            "--opt-modal-shadow": "0 24px 60px rgba(15, 23, 42, .28)",
            "--opt-toast-bg": "#1d2d3e",
            "--opt-toast-text": "#ffffff",
            "--opt-danger-hover-bg": "#d13438",
            "--opt-danger-hover-text": "#ffffff",
            "--opt-titlebar-icon-color": "#0070f2",
            "--opt-titlebar-hover-bg": "#e5f1ff",
            "--opt-titlebar-active-bg": "#d8ecff"
        },
        dark: {
            "--opt-bg-color": "#12171c",
            "--opt-panel-color": "#1b242d",
            "--opt-header-color": "#1b242d",
            "--opt-content-color": "#0f151a",
            "--opt-menu-color": "#1b242d",
            "--opt-border-color": "#33414f",
            "--opt-border-soft-color": "#2a3540",
            "--opt-text-color": "#dce4ed",
            "--opt-title-color": "#f1f5f9",
            "--opt-muted-text-color": "#9caaba",
            "--opt-primary-color": "#36a9ff",
            "--opt-primary-hover-color": "#5cbcff",
            "--opt-primary-soft-color": "#12334b",
            "--opt-button-bg": "#1b252e",
            "--opt-button-hover-bg": "#253340",
            "--opt-button-active-bg": "#2d3d4b",
            "--opt-input-bg": "#24313c",
            "--opt-input-border": "#506273",
            "--opt-focus-shadow": "0 0 0 2px rgba(54, 169, 255, .26)",
            "--opt-menu-hover-bg": "#24313c",
            "--opt-menu-active-bg": "#17324a",
            "--opt-menu-active-text": "#f1f5f9",
            "--opt-scrollbar-track": "#182028",
            "--opt-scrollbar-thumb": "#708297",
            "--opt-scrollbar-thumb-hover": "#91a2b5",
            "--opt-overlay-bg": "rgba(4, 8, 12, .68)",
            "--opt-modal-bg": "#1b242d",
            "--opt-modal-header-bg": "#1f2a34",
            "--opt-modal-shadow": "0 20px 54px rgba(0, 0, 0, .5)",
            "--opt-toast-bg": "#24313c",
            "--opt-toast-text": "#f1f5f9",
            "--opt-danger-hover-bg": "#d13438",
            "--opt-danger-hover-text": "#ffffff",
            "--opt-titlebar-icon-color": "#36a9ff",
            "--opt-titlebar-hover-bg": "#253340",
            "--opt-titlebar-active-bg": "#2d3d4b"
        }
    };

    const OPTION_POPUP_MESSAGES = {
        KO: {
            "823": "UI 선택 스타일 설정",
            "824": "UI 선택 스타일 미리보기",
            "825": "기본 설정",
            "826": "색상 설정",
            "827": "UI 선택 스타일",
            "828": "Context Menu 선택 스타일",
            "829": "프리셋",
            "830": "초기화",
            "831": "테두리 색상",
            "832": "내부 색상",
            "833": "내부 색상 사선 효과",
            "834": "네온 효과",
            "835": "각도",
            "836": "간격",
            "837": "두께",
            "838": "기본값",
            "839": "프리셋 이름 변경",
            "840": "프리셋 이름을 입력해주세요.",
            "841": "동일한 프리셋 이름이 이미 존재합니다.",
            "842": "프리셋 이름이 변경되었습니다.",
            "843": "사용자 프리셋 저장",
            "844": "변경한 UI 선택 스타일을 저장할 프리셋 설명을 입력하세요.",
            "845": "프리셋 설명",
            "846": "프리셋 설명을 입력해주세요.",
            "847": "현재 프리셋에 변경 내용을 저장하시겠습니까?",
            "848": "UI 선택 스타일 설정이 적용되었습니다.",
            "849": "사용자 프리셋이 저장되었습니다.",
            "850": "사용자 프리셋이 변경되었습니다.",
            "851": "사용자 프리셋 삭제",
            "852": "선택한 사용자 프리셋을 삭제하시겠습니까?",
            "853": "사용자 프리셋이 삭제되었습니다.",
            "854": "기본 프리셋은 변경하거나 삭제할 수 없습니다.",
            "859": "디자인 영역의 미리보기 화면에서 선택한 UI의 색상 표현과, 우클릭 Context Menu 호출 시 대상 UI에 표시되는 UI 선택 스타일을 관리합니다.",
            "860": "UI 선택 강조 효과와 Context Menu 대상 UI 강조 효과 중 어떤 표현을 설정할지 선택하고, 적용할 프리셋을 지정합니다.",
            "861": "디자인 미리보기에서 직접 선택한 UI의 표시 효과를 조정할지, 우클릭 Context Menu를 호출한 대상 UI의 UI 선택 스타일을 조정할지 선택합니다.",
            "862": "선택한 상황에 적용할 스타일 프리셋입니다. 기본 프리셋을 수정해 적용하면 사용자 정의 프리셋으로 저장됩니다.",
            "863": "선택된 UI를 명확히 식별할 수 있도록 테두리, 내부 색상, 사선 패턴의 색상과 투명도를 조정합니다.",
            "864": "현재 화면에서 변경한 선택 스타일 색상값을 선택된 프리셋의 저장값으로 되돌립니다. 저장된 프리셋 데이터는 변경하지 않습니다.",
            "865": "현재 프리셋 기준에서 변경된 선택 스타일 색상값이 없습니다.",
            "866": "선택된 UI 또는 Context Menu 대상 UI의 외곽을 표시하는 테두리 색상입니다.",
            "867": "선택된 UI 내부에 덮어 표시되는 강조 색상입니다. 투명도를 조정해 원래 UI가 보이는 정도를 제어합니다.",
            "868": "선택된 UI 내부에 사선 패턴으로 표시되는 보조 강조 효과입니다. 배경과 구분이 필요할 때 사용합니다.",
            "869": "선택된 UI의 외곽 강조에 사용할 테두리 색상을 팔레트에서 선택합니다.",
            "870": "선택된 UI 내부를 덮어 표시할 강조 색상을 팔레트에서 선택합니다.",
            "871": "선택된 UI 위에 표시할 사선 패턴 색상을 팔레트에서 선택합니다.",
            "872": "선택된 UI의 외곽선을 더 강하게 식별할 수 있도록 네온 형태의 강조 효과를 적용합니다.",
            "873": "설정값과 미리보기 결과를 함께 확인하기 쉽도록 설정 영역과 미리보기 영역의 크기를 조정합니다.",
            "874": "UI 선택 또는 Context Menu 대상 UI에 적용될 스타일을 저장 전에 확인하는 영역입니다.",
            "875": "디자인 영역에서 UI가 선택되었거나 우클릭 대상이 되었을 때 표시될 강조 효과를 미리 확인합니다.",
            "876": "UI 선택 스타일 설정과 관련된 도움말 문서를 엽니다.",
            "877": "현재 프리셋과 변경된 스타일 값을 디자인 영역의 선택 UI 표현 또는 Context Menu 대상 UI 표현에 적용합니다.",
            "878": "현재 선택한 사용자 정의 선택 스타일 프리셋을 삭제하고 기본 프리셋 기준으로 되돌립니다.",
            "879": "선택된 UI 외곽선의 빨강 성분을 조정해 테두리 강조 색상을 구성합니다.",
            "880": "선택된 UI 외곽선의 초록 성분을 조정해 테두리 강조 색상을 구성합니다.",
            "881": "선택된 UI 외곽선의 파랑 성분을 조정해 테두리 강조 색상을 구성합니다.",
            "882": "선택된 UI 외곽선의 투명도를 조정해 원래 화면과의 대비를 맞춥니다.",
            "883": "선택된 UI 내부 색상의 빨강 성분을 조정합니다.",
            "884": "선택된 UI 내부 색상의 초록 성분을 조정합니다.",
            "885": "선택된 UI 내부 색상의 파랑 성분을 조정합니다.",
            "886": "선택된 UI 내부 색상의 투명도를 조정해 대상 UI가 가려지는 정도를 제어합니다.",
            "887": "선택된 UI 위에 표시되는 사선 패턴의 빨강 성분을 조정합니다.",
            "888": "선택된 UI 위에 표시되는 사선 패턴의 초록 성분을 조정합니다.",
            "889": "선택된 UI 위에 표시되는 사선 패턴의 파랑 성분을 조정합니다.",
            "890": "선택된 UI 위에 표시되는 사선 패턴의 투명도를 조정합니다. 0%이면 사선이 표시되지 않습니다.",
            "891": "선택된 UI 위에 표시되는 사선 패턴의 방향을 조정합니다.",
            "892": "선택된 UI 위에 표시되는 사선 패턴 사이의 간격을 조정합니다.",
            "893": "선택된 UI 위에 표시되는 사선 패턴 한 줄의 두께를 조정합니다.",
            "894": "사용자 정의 프리셋 이름을 변경합니다.",
            "895": "기본 프리셋은 이름을 변경할 수 없습니다.",
            "896": "UI 선택 강조 효과에 사용할 색상으로 지정합니다.",
            "897": "디자인 미리보기의 선택 UI 또는 Context Menu 대상 UI에 표시할 강조 색상을 직접 지정합니다.",
            "898": "강조 색상이 원래 UI를 덮는 정도를 조정합니다. 0%는 투명, 100%는 불투명입니다.",
            "899": "HEX 색상값을 직접 입력합니다. 예: #ffff00",
            "900": "선택한 색상과 투명도를 현재 UI 선택 스타일 설정에 반영합니다.",
            "901": "색상 선택을 취소하고 기존 UI 선택 스타일 색상으로 돌아갑니다.",
            "902": "UI 선택 스타일 KEY 생성에 실패했습니다.",
            "903": "색상 팔레트",
            "904": "직접 색상",
            "905": "HEX 색상 형식이 올바르지 않습니다. 예: #ffff00",
            "906": "프리셋 정보를 찾을 수 없습니다.",
            "907": "밝은 UI 선택 스타일",
            "908": "굵은 네온사인",
            "909": "네온 사선",
            "910": "Context 기본 효과",
            "911": "Context 네온 효과"
        },
        EN: {
            "823": "UI Selection Style Settings",
            "824": "UI Selection Style Preview",
            "825": "Basic Settings",
            "826": "Color Settings",
            "827": "UI Selection Style",
            "828": "Context Menu Selection Style",
            "829": "Preset",
            "830": "Reset",
            "831": "Border Color",
            "832": "Fill Color",
            "833": "Fill Stripe Effect",
            "834": "Neon Effect",
            "835": "Angle",
            "836": "Gap",
            "837": "Width",
            "838": "Default",
            "839": "Rename Preset",
            "840": "Enter a preset name.",
            "841": "A preset with the same name already exists.",
            "842": "Preset name changed.",
            "843": "Save User Preset",
            "844": "Enter a preset description to save the changed UI selection style.",
            "845": "Preset Description",
            "846": "Enter a preset description.",
            "847": "Save changes to the current preset?",
            "848": "UI selection style settings have been applied.",
            "849": "User preset saved.",
            "850": "User preset updated.",
            "851": "Delete User Preset",
            "852": "Delete the selected user preset?",
            "853": "User preset deleted.",
            "854": "Default presets cannot be changed or deleted.",
            "859": "Manage the color expression shown for a selected UI in the design preview and the UI selection style shown on the target UI when the Context Menu is opened.",
            "860": "Select whether to configure the selected UI highlight or the Context Menu target UI highlight, then choose the preset to apply.",
            "861": "Choose whether to adjust the display effect for a directly selected UI in the design preview or the UI selection style for the target UI used to open the Context Menu.",
            "862": "Style preset for the selected situation. If a default preset is modified and applied, it is saved as a user preset.",
            "863": "Adjust border, fill, stripe color, and transparency so the selected UI is clearly identifiable.",
            "864": "Revert the changed selection style color values on this screen to the values saved in the selected preset. Saved preset data is not changed.",
            "865": "There are no changed selection style color values compared with the current preset.",
            "866": "Border color used to outline the selected UI or Context Menu target UI.",
            "867": "Highlight color overlaid inside the selected UI. Adjust transparency to control how much of the original UI remains visible.",
            "868": "Secondary highlight shown as a stripe pattern inside the selected UI. Use it when separation from the background is needed.",
            "869": "Select the border color for the selected UI outline from the palette.",
            "870": "Select the highlight fill color to overlay inside the selected UI from the palette.",
            "871": "Select the stripe pattern color shown over the selected UI from the palette.",
            "872": "Apply a neon-style highlight to make the selected UI outline easier to identify.",
            "873": "Resize the settings and preview areas so settings and preview results are easier to compare.",
            "874": "Area for previewing the style that will be applied to the selected UI or Context Menu target UI before saving.",
            "875": "Preview the highlight effect shown when a UI is selected or used as the right-click target in the design area.",
            "876": "Open the help document for UI selection style settings.",
            "877": "Apply the current preset and changed style values to the selected UI or Context Menu target UI in the design area.",
            "878": "Delete the selected custom selection style preset and return to the default preset.",
            "879": "Adjust the red component of the selected UI outline to build the border highlight color.",
            "880": "Adjust the green component of the selected UI outline to build the border highlight color.",
            "881": "Adjust the blue component of the selected UI outline to build the border highlight color.",
            "882": "Adjust the transparency of the selected UI outline to match contrast with the original screen.",
            "883": "Adjust the red component of the selected UI fill color.",
            "884": "Adjust the green component of the selected UI fill color.",
            "885": "Adjust the blue component of the selected UI fill color.",
            "886": "Adjust the transparency of the selected UI fill color to control how much the target UI is covered.",
            "887": "Adjust the red component of the stripe pattern shown over the selected UI.",
            "888": "Adjust the green component of the stripe pattern shown over the selected UI.",
            "889": "Adjust the blue component of the stripe pattern shown over the selected UI.",
            "890": "Adjust the transparency of the stripe pattern shown over the selected UI. At 0%, the stripe is not displayed.",
            "891": "Adjust the direction of the stripe pattern shown over the selected UI.",
            "892": "Adjust the gap between stripe pattern lines shown over the selected UI.",
            "893": "Adjust the width of each stripe pattern line shown over the selected UI.",
            "894": "Rename the user preset.",
            "895": "Default presets cannot be renamed.",
            "896": "Use this color for the selected UI highlight.",
            "897": "Directly specify the highlight color displayed on the selected UI or Context Menu target UI in the design preview.",
            "898": "Adjust how much the highlight color covers the original UI. 0% is transparent and 100% is opaque.",
            "899": "Enter the HEX color value directly. Example: #ffff00",
            "900": "Apply the selected color and transparency to the current UI selection style settings.",
            "901": "Cancel color selection and return to the existing UI selection style color.",
            "902": "Failed to create the UI selection style key.",
            "903": "Color Palette",
            "904": "Custom Color",
            "905": "Invalid HEX color format. Example: #ffff00",
            "906": "Preset information was not found.",
            "907": "Bright UI Selection Style",
            "908": "Bold Neon Sign",
            "909": "Neon Stripe",
            "910": "Context Default Effect",
            "911": "Context Neon Effect"
        }
    };

    function walkWindows(callback) {

        let oWin = global;

        for (let i = 0; i < 10 && oWin; i += 1) {

            try {

                if (callback(oWin) === false) {
                    return;
                }

                if (oWin.parent === oWin) {
                    return;
                }

                oWin = oWin.parent;

            } catch (error) {
                return;
            }

        }

    }

    function findInWindows(name) {

        let oFound;

        walkWindows(function (oWin) {

            if (typeof oWin[name] === "undefined") {
                return;
            }

            oFound = oWin[name];
            return false;

        });

        return oFound;

    }

    function getApp() {

        let oAPP;

        walkWindows(function (oWin) {

            if (typeof oWin.fn_getParent !== "function") {
                return;
            }

            oAPP = oWin.fn_getParent();
            return false;

        });

        return oAPP;

    }

    function getRequire() {

        const oReq = findInWindows("require");

        if (typeof oReq === "function") {
            return oReq;
        }

        const oAPP = getApp();

        if (oAPP?.REMOTE?.require) {
            return oAPP.REMOTE.require.bind(oAPP.REMOTE);
        }

    }

    function requireModule(name) {

        const oReq = getRequire();

        if (typeof oReq !== "function") {
            throw new Error("Module loader is not available.");
        }

        return oReq(name);

    }

    function getPath() {

        const oAPP = getApp();

        return oAPP?.PATH || oAPP?.path || requireModule("path");

    }

    function getFs() {

        const oAPP = getApp();

        return oAPP?.FS || oAPP?.fs || requireModule("fs");

    }

    function getPathInfo() {

        const oAPP = getApp();

        return oAPP?.PATHINFO || findInWindows("PATHINFO");

    }

    function getWsUtil() {

        const oAPP = getApp();

        return oAPP?.WSUTIL || findInWindows("WSUTIL");

    }

    function getUserInfo() {

        const oAPP = getApp();
        const oProcess = findInWindows("process");

        return oAPP?.IF_DATA?.oUserInfo ||
            oAPP?.IF_DATA?.USERINFO ||
            oAPP?.IF_DATA ||
            oProcess?.USERINFO ||
            {};

    }

    function getSysId() {

        const oInfo = getUserInfo();
        return oInfo?.SYSID || "";

    }

    function isHelpButtonAvailable() {

        const sSysID = getSysId();
        const oWsUtil = getWsUtil();

        if (!sSysID || typeof oWsUtil?.getWsWLOListAsync !== "function") {
            return Promise.resolve(false);
        }

        if (!oHelpAvailabilityCache[sSysID]) {
            oHelpAvailabilityCache[sSysID] = Promise.resolve(oWsUtil.getWsWLOListAsync(sSysID))
                .then(function (list) {

                    if (Array.isArray(list) === false) {
                        return false;
                    }

                    return list.some(function (item) {
                        return item?.REGTYP === "C" && item?.CHGOBJ === HELP_WLO_CHGOBJ;
                    });

                })
                .catch(function () {
                    return false;
                });
        }

        return oHelpAvailabilityCache[sSysID];

    }

    function applyHelpButtonAvailability(button) {

        if (!button) {
            return Promise.resolve(false);
        }

        button.hidden = true;
        button.style.display = "none";
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");

        return isHelpButtonAvailable().then(function (available) {

            const bAvailable = available === true;
            button.hidden = bAvailable !== true;
            button.style.display = bAvailable ? "" : "none";
            button.disabled = bAvailable !== true;

            if (bAvailable) {
                button.removeAttribute("aria-disabled");
            } else {
                button.setAttribute("aria-disabled", "true");
            }

            return bAvailable;

        });

    }

    function getLanguageKey() {

        const oInfo = getUserInfo();
        const sLanguage = String(oInfo?.WSLANGU || oInfo?.LANGU || global.navigator?.language || "").toUpperCase();

        return sLanguage.indexOf("EN") === 0 ? "EN" : "KO";

    }

    function getP13nRoot() {

        const oAPP = getApp();
        const oPath = getPath();
        const oPathInfo = getPathInfo();

        return oPathInfo?.P13N_ROOT ||
            oPath.join(oAPP?.USERDATA || oAPP?.USERDATA_PATH || "", "p13n");

    }

    function ensureDir(folderPath) {

        const oFs = getFs();

        if (oFs.existsSync(folderPath) === true) {
            return;
        }

        oFs.mkdirSync(folderPath, { recursive: true });

    }

    function readJson(filePath) {

        const oFs = getFs();

        if (oFs.existsSync(filePath) === false) {
            return;
        }

        try {
            return JSON.parse(oFs.readFileSync(filePath, "utf-8"));
        } catch (error) {
            return;
        }

    }

    function writeJson(filePath, data) {

        const oPath = getPath();

        ensureDir(oPath.dirname(filePath));
        getFs().writeFileSync(filePath, JSON.stringify(data), "utf-8");

    }

    function getThemeInfo() {

        const oAPP = getApp();

        if (typeof oAPP?.fn?.getThemeInfo === "function") {

            const oThemeInfo = oAPP.fn.getThemeInfo();

            if (oThemeInfo) {
                return oThemeInfo;
            }

        }

        const sSysID = getSysId();

        if (!sSysID) {
            return Object.assign({}, DEFAULT_THEME);
        }

        const oPath = getPath();
        const sThemePath = oPath.join(getP13nRoot(), "theme", `${sSysID}.json`);
        const oThemeJson = readJson(sThemePath);

        return oThemeJson || Object.assign({}, DEFAULT_THEME);

    }

    function getThemeBackgroundColor(theme) {

        const oWsUtil = getWsUtil();

        if (typeof oWsUtil?.getThemeBackgroundColor === "function") {
            return oWsUtil.getThemeBackgroundColor(theme);
        }

        return THEME_BACKGROUND[theme] || DEFAULT_THEME.BGCOL;

    }

    function getMsgClsText(cls, no) {

        const oAPP = getApp();
        const aParams = Array.prototype.slice.call(arguments, 2);
        const sMissingText = cls && no ? `${cls} ${no}` : "";
        const sMsgNo = String(no || "").padStart(3, "0");
        const oLocalMessages = OPTION_POPUP_MESSAGES[getLanguageKey()] || OPTION_POPUP_MESSAGES.KO;
        const sLocalText = cls === "ZMSG_WS_COMMON_001" ? oLocalMessages?.[sMsgNo] : "";

        if (!cls || !no) {
            return "";
        }

        if (sLocalText) {
            return sLocalText;
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

    function composeMsgText(cls, no, options) {

        const sText = getMsgClsText(cls, no);
        const sPrefix = typeof options?.prefix === "string" ? options.prefix : "";
        const sSuffix = typeof options?.suffix === "string" ? options.suffix : "";

        return `${sPrefix}${sText}${sSuffix}`;

    }

    function applyText(root) {

        const oRoot = root || document;

        oRoot.querySelectorAll("[data-opt-msg-cls][data-opt-msg-no]").forEach(function (node) {
            node.textContent = composeMsgText(node.dataset.optMsgCls, node.dataset.optMsgNo, {
                prefix: node.dataset.optPrefix,
                suffix: node.dataset.optSuffix
            });
        });

        oRoot.querySelectorAll("[data-opt-title-msg-cls][data-opt-title-msg-no]").forEach(function (node) {
            node.title = getMsgClsText(node.dataset.optTitleMsgCls, node.dataset.optTitleMsgNo);
        });

        oRoot.querySelectorAll("[data-opt-placeholder-msg-cls][data-opt-placeholder-msg-no]").forEach(function (node) {
            node.placeholder = getMsgClsText(node.dataset.optPlaceholderMsgCls, node.dataset.optPlaceholderMsgNo);
        });

        oRoot.querySelectorAll("[data-opt-aria-msg-cls][data-opt-aria-msg-no]").forEach(function (node) {
            node.setAttribute("aria-label", getMsgClsText(node.dataset.optAriaMsgCls, node.dataset.optAriaMsgNo));
        });

    }

    function getThemeVariables(oThemeInfo) {

        const oTheme = oThemeInfo || getThemeInfo();
        const bDark = String(oTheme?.THEME || "").toLowerCase().indexOf("dark") !== -1;
        const oVariables = Object.assign({}, THEME_VARIABLES[bDark ? "dark" : "light"]);
        const sBgColor = oTheme?.BGCOL || getThemeBackgroundColor(oTheme?.THEME);

        oVariables["--opt-bg-color"] = sBgColor || oVariables["--opt-bg-color"];
        oVariables["--op-bg"] = oVariables["--opt-bg-color"];

        return oVariables;

    }

    function setCssVariables(targetDocument, variables) {

        const oRoot = (targetDocument || document).documentElement;

        Object.keys(variables || {}).forEach(function (key) {
            oRoot.style.setProperty(key, variables[key]);
        });

    }

    function applyThemeShell(oThemeInfo) {

        const oTheme = oThemeInfo || getThemeInfo();
        const sBgColor = oTheme?.BGCOL || getThemeBackgroundColor(oTheme?.THEME);
        const bDark = String(oTheme?.THEME || "").toLowerCase().indexOf("dark") !== -1;
        const oVariables = getThemeVariables(oTheme);

        setCssVariables(document, oVariables);
        document.body.style.backgroundColor = sBgColor;
        document.body.classList.toggle("op-dark", bDark);
        document.body.classList.toggle("op-light", !bDark);

        try {

            const oAPP = getApp();
            const oWin = oAPP?.REMOTE?.getCurrentWindow?.() || oAPP?.CURRWIN;

            oWin?.webContents?.insertCSS(`html, body { margin: 0; height: 100%; background-color: ${sBgColor}; }`);

        } catch (error) {
            return;
        }

    }

    /**
     * @since   2026-06-12 01:36:51
     * @version v3.6.4-4
     * @author  PES
     * @description
     * 도움말 문서 요청 시 옵션 팝업 Busy 상태를 먼저 확인하고, 요청 중에는 추가 클릭이 동작하지 않도록 Busy 상태를 제어한다.
     */
    function isOptionPopupBusy() {

        try {

            if (typeof global.parent?.OptionPopupMain?.isBusy === "function") {
                return global.parent.OptionPopupMain.isBusy() === true;
            }

        } catch (error) {
            return false;
        }

        const oAPP = getApp();

        try {
            return typeof oAPP?.fn?.getBusy === "function" && oAPP.fn.getBusy() === true;
        } catch (error) {
            return false;
        }

    }

    /**
     * @since   2026-06-12 01:36:51
     * @version v3.6.4-4
     * @author  PES
     * @description
     * 도움말 문서 다운로드 및 오픈 처리가 완료되기 전까지 옵션 팝업 화면에 Busy를 표시한다.
     */
    function setOptionPopupBusy(bIsBusy) {

        const bBusy = bIsBusy === true;

        try {

            if (typeof global.parent?.OptionPopupMain?.setBusy === "function") {
                global.parent.OptionPopupMain.setBusy(bBusy);
                return;
            }

        } catch (error) {
            return;
        }

        const oAPP = getApp();

        try {

            if (typeof oAPP?.fn?.setBusy === "function") {
                oAPP.fn.setBusy(bBusy);
            }

        } catch (error) {
            return;
        }

    }

    function openHelpDocument(startMenuId) {

        if (isOptionPopupBusy() === true) {
            return;
        }

        setOptionPopupBusy(true);

        const oAPP = getApp();
        const sRawStartMenuId = typeof startMenuId === "undefined" || startMenuId === null ? "" : String(startMenuId).trim();
        const sStartMenuId = /^\d+$/.test(sRawStartMenuId) ? sRawStartMenuId.padStart(6, "0") : sRawStartMenuId;
        const oOptions = {};
        const bHasStartMenuId = !!sStartMenuId;

        if (bHasStartMenuId) {
            oOptions.startMenuId = sStartMenuId;
        }

        const sSysID = getSysId();

        if (sSysID && typeof oAPP?.IPCRENDERER?.send === "function") {

            const oPayload = {
                PRCCD: "U4A_HELP_DOCUMENT"
            };

            if (bHasStartMenuId) {
                oPayload.DATA = oOptions;
            }

            try {
                oAPP.IPCRENDERER.send(`if-optionPopup-${sSysID}`, oPayload);
                return;
            } catch (error) {
                setOptionPopupBusy(false);
                throw error;
            }
        }

        if (typeof oAPP?.fn?.fnU4AHelpDocuPopupOpener === "function") {

            try {

                return Promise.resolve(oAPP.fn.fnU4AHelpDocuPopupOpener(bHasStartMenuId ? oOptions : undefined))
                    .finally(function () {
                        setOptionPopupBusy(false);
                    });

            } catch (error) {
                setOptionPopupBusy(false);
                throw error;
            }

        }

        setOptionPopupBusy(false);

    }

    function unlockAndShowWindow() {

        const oAPP = getApp();

        try {
            oAPP?.CURRWIN?.show?.();
            oAPP?.WSUTIL?.setBrowserOpacity?.(oAPP.CURRWIN);
            oAPP?.IPCRENDERER?.send?.(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });
        } catch (error) {
            return;
        }

    }

    global.OptionPopupUtil = {
        DEFAULT_THEME,
        THEME_BACKGROUND,
        THEME_VARIABLES,
        walkWindows,
        findInWindows,
        getApp,
        getRequire,
        requireModule,
        getPath,
        getFs,
        getPathInfo,
        getWsUtil,
        getUserInfo,
        getSysId,
        isHelpButtonAvailable,
        applyHelpButtonAvailability,
        getP13nRoot,
        ensureDir,
        readJson,
        writeJson,
        getThemeInfo,
        getThemeBackgroundColor,
        applyText,
        getMsgClsText,
        getThemeVariables,
        setCssVariables,
        applyThemeShell,
        HELP_DOCUMENT_OPEN_PRCCD,
        isOptionPopupBusy,
        setOptionPopupBusy,
        openHelpDocument,
        unlockAndShowWindow
    };

})(window);
