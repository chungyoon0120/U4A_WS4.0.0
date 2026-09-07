/* SAP 공식 일러스트 SVG(OpenUI5 1.107.1, Apache-2.0) → 색상변수를 실제 SAP sap_horizon /
 * sap_horizon_dark 테마 색상값으로 바꿔 정적 SVG 2벌(밝게/어둡게)씩 생성.
 * 값 출처: 이 프로젝트가 실제 쓰는 CDN의 sap/m/themes/{theme}/library.css :root 값(실측).
 * 두 계열의 색상변수가 있다: 구형 라인아트(--sapIllus_*, 8개) / 최근형 사진풍(--sapContent_Illustrative_ColorN, 10개).
 * 실행: node build-tnt-illustrations.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve(__dirname, "../../www/svg");

const ILLUS_COLORS = {
    light: {
        AccentColor: "#f58b00",
        BackgroundColor: "#ebf8ff",
        BrandColorPrimary: "#5d36ff",
        BrandColorSecondary: "#0070f2",
        Layering1: "#a9b4be",
        Layering2: "#d5dadd",
        ObjectFillColor: "#fff",
        StrokeDetailColor: "#00144a",
        NoColor: "none",
    },
    dark: {
        AccentColor: "#f58b00",
        BackgroundColor: "#223548",
        BrandColorPrimary: "#5d36ff",
        BrandColorSecondary: "#4098ff",
        Layering1: "#fff",
        Layering2: "#b9c1c6",
        ObjectFillColor: "#fff",
        StrokeDetailColor: "#5581ae",
        NoColor: "none",
    },
};

// 사진풍(사람/장면) 일러스트가 쓰는 최근 테마 변수(sapIllus_* 와 다른 계열). 값 출처는 위와 동일(library.css).
const CONTENT_COLORS = {
    light: { 2: "#0070f2", 3: "#f58b00", 4: "#00144a", 7: "#ebf8ff", 9: "#64edd2", 14: "#004da5", 15: "#cc7400", 17: "#00a58a", 18: "#d1efff", 19: "#b8e6ff" },
    dark: { 2: "#4098ff", 3: "#f58b00", 4: "#5581ae", 7: "#223548", 9: "#64edd2", 14: "#0070f3", 15: "#cc7400", 17: "#00a58a", 18: "#2a4259", 19: "#324e6b" },
};

// 처리할 일러스트 목록: 원본 illustrationType/illustrationSize → 원본 파일명 → 출력 파일 접두.
// family: "illus"=구형 라인아트(--sapIllus_*), "content"=사진풍(--sapContent_Illustrative_ColorN)
const ENTRIES = [
    { src: "_source_tnt-Dialog-Systems.svg", outBase: "tnt-systems", origId: "tnt-Dialog-Systems", family: "illus" },
    { src: "_source_tnt-Dialog-SessionExpired.svg", outBase: "session-expired", origId: "tnt-Dialog-SessionExpired", family: "illus" },
    { src: "_source_tnt-Spot-Lock.svg", outBase: "trial-lock", origId: "tnt-Spot-Lock", family: "illus" },
    { src: "_source_sapIllus-Dialog-BeforeSearch.svg", outBase: "login-checking", origId: "sapIllus-Dialog-BeforeSearch", family: "illus" },
    { src: "_source_tnt-Dialog-UnsuccessfulAuth.svg", outBase: "login-noauth", origId: "tnt-Dialog-UnsuccessfulAuth", family: "illus" },
    { src: "_source_tnt-Dialog-Teams.svg", outBase: "activated-windows", origId: "tnt-Dialog-Teams", family: "illus" },
    { src: "_source_sapIllus-Dialog-SuccessHighFive.svg", outBase: "login-success", origId: "sapIllus-Dialog-SuccessHighFive", family: "content" },
    { src: "_source_sapIllus-Dialog-Connection.svg", outBase: "exit-confirm", origId: "sapIllus-Dialog-Connection", family: "content" },
    { src: "_source_tnt-Dialog-Radar.svg", outBase: "tnt-radar", origId: "tnt-Dialog-Radar", family: "illus" },
];

// sapIllus-Patterns.svg(sap.m, base) 의 두 패턴(PatternShadow=도트/BrandColorPrimary,
// PatternHighlight=도트/ObjectFillColor) 을 그대로 이식. 원본은 CSS 클래스(sapIllus_NoColor 등)로
// 칠하지만, 여기선 정적 파일이라 그 테마 값을 바로 채워 넣는다.
function buildPatternDefs(oColor, bShadow, bHighlight) {
    var s = "<defs>";
    if (bShadow) {
        s += `<pattern id="sapIllus_PatternShadow" width="3" height="5.5" patternUnits="userSpaceOnUse" viewBox="0 0 3 5.5">` +
            `<rect fill="none" width="3" height="5.5"/>` +
            `<circle fill="${oColor.BrandColorPrimary}" cx="3" cy="5.5001" r="0.5"/>` +
            `<circle fill="${oColor.BrandColorPrimary}" cy="5.5001" r="0.5"/>` +
            `<circle fill="${oColor.BrandColorPrimary}" cx="1.5" cy="2.7501" r="0.5"/>` +
            `<circle fill="${oColor.BrandColorPrimary}" cx="3" cy="0.0001" r="0.5"/>` +
            `<circle fill="${oColor.BrandColorPrimary}" cy="0.0001" r="0.5"/>` +
            `</pattern>`;
    }
    if (bHighlight) {
        s += `<pattern id="sapIllus_PatternHighlight" width="3" height="5.5" patternTransform="translate(35.9059 309.6208)" patternUnits="userSpaceOnUse" viewBox="0 0 3 5.5">` +
            `<rect fill="none" width="3" height="5.5"/>` +
            `<circle fill="${oColor.ObjectFillColor}" cx="3.0001" cy="5.5001" r="0.5"/>` +
            `<circle fill="${oColor.ObjectFillColor}" cx="0.0001" cy="5.5001" r="0.5"/>` +
            `<circle fill="${oColor.ObjectFillColor}" cx="1.5001" cy="2.7501" r="0.5"/>` +
            `<circle fill="${oColor.ObjectFillColor}" cx="3.0001" cy="0.0001" r="0.5"/>` +
            `<circle fill="${oColor.ObjectFillColor}" cx="0.0001" cy="0.0001" r="0.5"/>` +
            `</pattern>`;
    }
    return s + "</defs>";
}

function ensureXmlns(svg) {
    // ★실측(2026-09-07): 원본 OpenUI5 소스 일부는 xmlns 선언이 없다(IllustrationPool 이 기존 SVG
    //   문서 안에 인라인 삽입하는 걸 전제). <img src> 단독 로드(§16 2.3, 인라인 금지)엔 xmlns 없으면
    //   Chromium 이 디코딩을 거부(onerror)한다 — 없으면 보강.
    if (!/xmlns=/.test(svg)) { svg = svg.replace(/<svg /, '<svg xmlns="http://www.w3.org/2000/svg" '); }
    return svg;
}

function buildIllus(sSrcPath, sOrigId, sMode) {
    const oColor = ILLUS_COLORS[sMode];
    let svg = ensureXmlns(fs.readFileSync(sSrcPath, "utf8"));

    var bShadow = /(?:var\(--sapIllus_PatternShadow\)|class="sapIllus_PatternShadow")/.test(svg);
    var bHighlight = /(?:var\(--sapIllus_PatternHighlight\)|class="sapIllus_PatternHighlight")/.test(svg);
    svg = svg.replace(/var\(--sapIllus_PatternShadow\)/g, "url(#sapIllus_PatternShadow)");
    svg = svg.replace(/var\(--sapIllus_PatternHighlight\)/g, "url(#sapIllus_PatternHighlight)");

    // 인라인 fill="var(--sapIllus_X)" 가 있는 원본(대부분)은 여기서 바로 실제 색으로 바뀐다.
    svg = svg.replace(/var\(--sapIllus_([A-Za-z0-9]+)\)/g, (m, sName) => {
        if (!(sName in oColor)) { throw new Error("미확인 색상 변수: sapIllus_" + sName + " (" + sSrcPath + ")"); }
        return oColor[sName];
    });

    // ★실측(2026-09-07, BeforeSearch): 원본 중 일부는 fill 속성 없이 class="sapIllus_X" 만 있고
    //   색은 외부 스타일시트(sap.m library.css 의 .sapIllus_X{fill:var(--sapIllus_X)})에 의존한다.
    //   정적 단독 파일이라 그 스타일시트가 없어 검은 실루엣으로 뜬다 — 실제 나온 class 이름을 스캔해
    //   <style> 로 색을 직접 박아 넣는다(위 인라인 치환과 중복돼도 무해).
    var oUsedClasses = {};
    var reClass = /class="([^"]*)"/g, mClass;
    while ((mClass = reClass.exec(svg))) {
        mClass[1].split(/\s+/).forEach((sCls) => {
            var mName = /^sapIllus_([A-Za-z0-9]+)$/.exec(sCls);
            if (mName) { oUsedClasses[sCls] = mName[1]; }
        });
    }
    var aRules = Object.keys(oUsedClasses).map((sCls) => {
        var sName = oUsedClasses[sCls];
        var sVal;
        if (sName === "PatternShadow") { sVal = "url(#sapIllus_PatternShadow)"; }
        else if (sName === "PatternHighlight") { sVal = "url(#sapIllus_PatternHighlight)"; }
        else if (sName in oColor) { sVal = oColor[sName]; }
        else { throw new Error("미확인 색상 클래스: " + sCls + " (" + sSrcPath + ")"); }
        return `.${sCls}{fill:${sVal}}`;
    });

    if (bShadow || bHighlight) {
        svg = svg.replace(/(<svg[^>]*>)/, `$1${buildPatternDefs(oColor, bShadow, bHighlight)}`);
    }
    if (aRules.length) {
        svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${aRules.join("")}</style>`);
    }

    svg = svg.replace(new RegExp('id="' + sOrigId + '"'), `id="${sOrigId}-${sMode}"`);
    return svg;
}

function buildContent(sSrcPath, sOrigId, sMode) {
    const oColor = CONTENT_COLORS[sMode];
    let svg = ensureXmlns(fs.readFileSync(sSrcPath, "utf8"));

    svg = svg.replace(/var\(--sapContent_Illustrative_Color([0-9]+)\)/g, (m, sNum) => {
        if (!(sNum in oColor)) { throw new Error("미확인 색상 변수: sapContent_Illustrative_Color" + sNum + " (" + sSrcPath + ")"); }
        return oColor[sNum];
    });

    // sapIllus_MaskTypeAlpha 클래스(마스크 합성방식 지정, 색 아님) — 정적 파일용 <style> 로 보강.
    if (/sapIllus_MaskTypeAlpha/.test(svg)) {
        svg = svg.replace(/(<svg[^>]*>)/, `$1<style>.sapIllus_MaskTypeAlpha{mask-type:alpha}</style>`);
    }

    svg = svg.replace(new RegExp('id="' + sOrigId + '"'), `id="${sOrigId}-${sMode}"`);
    return svg;
}

if (!fs.existsSync(OUT_DIR)) { throw new Error("출력 폴더 없음: " + OUT_DIR); }

for (const oEntry of ENTRIES) {
    const sSrcPath = path.join(__dirname, oEntry.src);
    if (!fs.existsSync(sSrcPath)) { throw new Error("원본 파일 없음: " + sSrcPath); }
    for (const sMode of ["light", "dark"]) {
        const sOut = oEntry.family === "content"
            ? buildContent(sSrcPath, oEntry.origId, sMode)
            : buildIllus(sSrcPath, oEntry.origId, sMode);
        const sPath = path.join(OUT_DIR, `${oEntry.outBase}-${sMode}.svg`);
        fs.writeFileSync(sPath, sOut, "utf8");
        console.log("생성:", sPath, `(${sOut.length} bytes)`);
    }
}
