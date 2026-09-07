/* SAP 공식 tnt-Dialog-Systems.svg(OpenUI5 1.107.1, Apache-2.0) → 색상변수(var(--sapIllus_*))를
 * 실제 SAP sap_horizon / sap_horizon_dark 테마 색상값으로 바꿔 정적 SVG 2벌(밝게/어둡게) 생성.
 * 값 출처: 이 프로젝트가 실제 쓰는 CDN의 sap/m/themes/{theme}/library.css :root 값(실측, .works/일러스트팝업 조사).
 * 실행: node build-tnt-systems-svg.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "_source_tnt-Dialog-Systems.svg");
const OUT_DIR = path.resolve(__dirname, "../../www/svg");

const COLORS = {
    light: {
        AccentColor: "#f58b00",
        BackgroundColor: "#ebf8ff",
        BrandColorPrimary: "#5d36ff",
        BrandColorSecondary: "#0070f2",
        Layering1: "#a9b4be",
        Layering2: "#d5dadd",
        ObjectFillColor: "#fff",
        StrokeDetailColor: "#00144a",
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
    },
};

// sapIllus-Patterns.svg(sap.m, base)의 PatternShadow 패턴 정의를 그대로 이식(도트 패턴).
// 원본은 CSS 클래스(sapIllus_NoColor/sapIllus_BrandColorPrimary)로 칠하지만, 여기선 정적 파일이라
// BrandColorPrimary 를 그 테마 값으로 바로 채워 넣는다(NoColor=투명).
function buildPatternDefs(oColor) {
    return `<defs><pattern id="sapIllus_PatternShadow" width="3" height="5.5" patternUnits="userSpaceOnUse" viewBox="0 0 3 5.5">` +
        `<rect fill="none" width="3" height="5.5"/>` +
        `<circle fill="${oColor.BrandColorPrimary}" cx="3" cy="5.5001" r="0.5"/>` +
        `<circle fill="${oColor.BrandColorPrimary}" cy="5.5001" r="0.5"/>` +
        `<circle fill="${oColor.BrandColorPrimary}" cx="1.5" cy="2.7501" r="0.5"/>` +
        `<circle fill="${oColor.BrandColorPrimary}" cx="3" cy="0.0001" r="0.5"/>` +
        `<circle fill="${oColor.BrandColorPrimary}" cy="0.0001" r="0.5"/>` +
        `</pattern></defs>`;
}

function build(sMode) {
    const oColor = COLORS[sMode];
    let svg = fs.readFileSync(SRC, "utf8");

    // var(--sapIllus_PatternShadow) → 로컬 pattern 참조(정적 파일이라 CSS 변수 대신 고정 id 참조)
    svg = svg.replace(/var\(--sapIllus_PatternShadow\)/g, "url(#sapIllus_PatternShadow)");

    // 나머지 var(--sapIllus_X) → 그 테마의 실제 값
    svg = svg.replace(/var\(--sapIllus_([A-Za-z0-9]+)\)/g, (m, sName) => {
        if (!(sName in oColor)) { throw new Error("미확인 색상 변수: " + sName); }
        return oColor[sName];
    });

    // <svg ...> 여는 태그 바로 뒤에 패턴 defs 삽입
    svg = svg.replace(/(<svg[^>]*>)/, `$1${buildPatternDefs(oColor)}`);

    // id 충돌 방지(원본 id="tnt-Dialog-Systems" 유지해도 무해하나 명시적으로 라이트/다크 구분)
    svg = svg.replace(/id="tnt-Dialog-Systems"/, `id="tnt-Dialog-Systems-${sMode}"`);

    return svg;
}

if (!fs.existsSync(OUT_DIR)) { throw new Error("출력 폴더 없음: " + OUT_DIR); }

for (const sMode of ["light", "dark"]) {
    const sOut = build(sMode);
    const sPath = path.join(OUT_DIR, `tnt-systems-${sMode}.svg`);
    fs.writeFileSync(sPath, sOut, "utf8");
    console.log("생성:", sPath, `(${sOut.length} bytes)`);
}
