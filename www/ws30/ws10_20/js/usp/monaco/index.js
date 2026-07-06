window.require.config({
    paths: {    
      'vs': MONACO_VS_ROOT_PATH   // ✅ 정확한 상대 경로
    }
});

/**********************************************************************
 * Language에 해당하는 스니펫을 구성한다.
 **********************************************************************/
function _setSnippetConfig(sLanguage){

    if(!sLanguage){
        return;
    }

    // 위에서 얻은 Language 로 스니펫 데이터 구하기
    let aSnippetStandard = _getStandardSnippetData(sLanguage) || [];

    let aP13nSnippetList = _getP13nSnippetList(sLanguage) || [];

    let aSnippetList = [];

    aSnippetList = aSnippetList.concat(aSnippetStandard);
    aSnippetList = aSnippetList.concat(aP13nSnippetList);

    // 스니펫 정보를 전역 변수에 저장한다.
    oAPP.attr.aSnippetData = aSnippetList || [];

} // end of _setSnippetConfig


/************************************************************************
 * @function - p13n 폴더에 저장된 Snippet 코드 정보를 구한다.
 ************************************************************************/
function _getP13nSnippetCodeData(sKey) {
    
    let sSnippetCodeFile = PATH.join(MONACO_EDITOR_SNIPPET_P13N_ROOT, sKey);

    if(FS.existsSync(sSnippetCodeFile) === false){
        return "";
    }

    try {
        
        let sSavedSnippetCode = FS.readFileSync(sSnippetCodeFile, 'utf-8');

        return sSavedSnippetCode;

    } catch (error) {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www/ws10_20/js/usp/monaco/index.js`,
            `=> _getP13nSnippetCodeData`,
            `=> FS.readFileSync(sSnippetCodeFile, 'utf-8')`,
            `=> p13n 폴더에 저장된 Snippet 코드 파일 읽다가 오류!!`,
            `=> sSnippetCodeFile: ${sSnippetCodeFile}`,
        ];

        console.error(aConsoleMsg.join("\r\n"));
        console.error(error);
        
    }

    return "";

} // end of _getP13nSnippetCodeData


/**********************************************************************
 * P13n에 저장되어 있는 스니펫 정보를 구한다.
 **********************************************************************/
function _getP13nSnippetList(sLanguage){

    if(!sLanguage){
        return;
    }

    let sSnippetListFile = PATH.join(MONACO_EDITOR_SNIPPET_P13N_ROOT, "list.json");
    if(FS.existsSync(sSnippetListFile) === false){
        return;
    }

    try {
			
        var sSavedSnippetList = FS.readFileSync(sSnippetListFile, 'utf-8');

    } catch (error) {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www/ws10_20/js/usp/monaco/index.js`,
            `=> _getP13nSnippetList`,
            `=> FS.readFileSync(sSnippetListFile, 'utf-8')`,
            `=> P13n에 저장되어 있는 스니펫 리스트 JSON 파일 읽다가 오류!!`,
            `=> sSnippetListFile: ${sSnippetListFile}`,
        ];

        console.error(aConsoleMsg.join("\r\n"));
        console.error(error);

        return;
    } 

    try {
    
        var aSavedSnippetList = JSON.parse(sSavedSnippetList);

    } catch (error) {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www/ws10_20/js/usp/monaco/index.js`,
            `=> _getP13nSnippetList`,
            `=> var aSavedSnippetList = JSON.parse(sSavedSnippetList)`,
            `=> P13n에 저장되어 있는 스니펫 리스트 JSON 파일 Parse 오류!!`,
            `=> sSavedSnippetList: ${sSavedSnippetList}`,
        ];

        console.error(aConsoleMsg.join("\r\n"));
        console.error(error);

        return;
        
    } 

    if(!aSavedSnippetList || Array.isArray(aSavedSnippetList) === false){
        return;
    }

    // 저장된 스니펫 목록 중, 전달받은 파라미터의 language가 같은 것만 추출
    aSavedSnippetList = aSavedSnippetList.filter(e => e?.snippet_langu === sLanguage);
    if(aSavedSnippetList.length === 0){
        return;
    }

    let aSnippetList = [];

    for(var oSavedSnippet of aSavedSnippetList){

        if(sLanguage !== oSavedSnippet.snippet_langu){
            continue;
        }            

        let oSnippet = JSON.parse(JSON.stringify(oAPP.types.S_SNIPPET));

        oSnippet.label          = oSavedSnippet.snippet_name;
        oSnippet.documentation  = oSavedSnippet.snippet_desc;
        oSnippet.insertText     = _getP13nSnippetCodeData(oSavedSnippet._key);

        aSnippetList.push(oSnippet);

    }

    return aSnippetList; 

} // end of _getP13nSnippetList

/**********************************************************************
 * Language에 해당하는 스니펫 데이터를 구한다.
 **********************************************************************/
function _getStandardSnippetData(sLanguage){

    if(!sLanguage){
        return;
    }

    // 스니펫 루트 폴더 경로
    let sSnippetRootPath = PATH.join(MONACO_LIB_PATH, "snippet", sLanguage);

    // // 테스트일 경우 로컬 디렉토리 바라보게..
	// if(!GRAND_FATHER.APP.isPackaged){
	// 	sSnippetRootPath = PATH.join("C:\\u4a_temp\\U4A USP\\monaco", "snippet", sLanguage);
	// }

    // 스니펫 루트 폴더가 없을 경우 빠져나감.
    if(FS.existsSync(sSnippetRootPath) === false){

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
            `=> _getStandardSnippetData`,
            `=> Snippet Langage: ${sLanguage}`,
            `=> SnippetRootPath: ${sSnippetRootPath}`,
            `=> 스니펫 루트 경로가 없음!!`,
        ];

        console.error(aConsoleMsg.join("\r\n"));

        return;
    }

    try {
        
        // 스니펫 루트 경로에 대한 정보를 구한다.
        var oPathInfo = FS.statSync(sSnippetRootPath);

        // 폴더가 맞는지 확인한다.
        if(oPathInfo.isDirectory() === false){

            // 콘솔용 오류 메시지
            var aConsoleMsg = [             
                `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
                `=> _getStandardSnippetData`,
                `=> FS.statSync(sSnippetRootPath)`,
                `=> Snippet Root Path: ${sSnippetRootPath}`,
                `=> 스니펫 루트 폴더 경로가 디렉토리가 아님!!!`,
            ];

            console.error(aConsoleMsg.join("\r\n"));

            return;
        }

    } catch (error) {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
            `=> _getStandardSnippetData`,
            `=> FS.statSync(sSnippetRootPath)`,
            `=> Snippet Root Path: ${sSnippetRootPath}`,
            `=> Snippet Langage: ${sLanguage}`,
            `=> 스니펫 루트 폴더 정보 구하려다가 오류!!`,
        ];

        console.error(error);
        console.error(aConsoleMsg.join("\r\n"));
    
        return;
    }

    try {

        // 스니펫 루트 폴더의 하위 정보를 구한다.
        var aSnippetFiles = FS.readdirSync(sSnippetRootPath);

        if(Array.isArray(aSnippetFiles) === false){
            return;
        }

        if(aSnippetFiles.length === 0){
            return;
        }

    } catch (error) {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [             
            `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
            `=> _getStandardSnippetData`,
            `=> FS.readdirSync(sSnippetRootPath)`,
            `=> Snippet Root Path: ${sSnippetRootPath}`,
            `=> Snippet Langage: ${sLanguage}`,
            `=> 스니펫 루트 폴더의 하위 목록 구하려다가 실패!!`,
        ];

        console.error(error);
        console.error(aConsoleMsg.join("\r\n"));
    
        return;
        
    }

    // 스니펫 정보 수집 공간
    let aSnippet = [];

    // 파일의 확장자가 JSON인 것만 추출
    aSnippetFiles = aSnippetFiles.filter(e => e && PATH.extname(e) === ".json");

    for(var sFileName of aSnippetFiles){

        let sSnippetJsonPath = PATH.join(sSnippetRootPath, sFileName);
        
        try {
            
            var sSnippetInfo = FS.readFileSync(sSnippetJsonPath, "utf-8");

        } catch (error) {

            // 콘솔용 오류 메시지
            var aConsoleMsg = [             
                `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
                `=> _getStandardSnippetData`,
                `=> FS.readFileSync(sSnippetJsonPath, "utf-8");`,
                `=> Json File Path: ${sSnippetJsonPath}`,                
                `=> JSON 파일 읽다가 오류!`
            ];

            console.error(error);
            console.error(aConsoleMsg.join("\r\n"));
            
            continue;
        }

        try {

            let aSnippetInfo = JSON.parse(sSnippetInfo);
            
            // JSON Parse 데이터 타입이 Array가 아닌경우 합치지 않음.
            if(Array.isArray(aSnippetInfo) === false){

                // 콘솔용 오류 메시지
                var aConsoleMsg = [             
                    `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
                    `=> _getStandardSnippetData`,
                    `=> Json File Path: ${sSnippetJsonPath}`, 
                    `=> Json Parse Data: ${JSON.stringify(aSnippetInfo)}`,
                    `=> JSON이 Array 타입이 아님!!!`
                ];
                
                console.error(aConsoleMsg.join("\r\n"));

                continue;

            }
            
            // 스니펫 정보 중, 필수 필드가 있는 것만 추출
            aSnippetInfo = aSnippetInfo.filter(e => e && e?.label && e?.kind && e?.insertText);

            if(aSnippetInfo.length === 0){
                continue;
            }

            aSnippet = aSnippet.concat(aSnippetInfo);

        } catch (error) {            

            // 콘솔용 오류 메시지
            var aConsoleMsg = [             
                `[PATH]: www\\ws10_20\\js\\usp\\monaco\\index.js`,
                `=> _getStandardSnippetData`,
                `=> aSnippetInfo = JSON.parse(sSnippetInfo)`,
                `=> Json File Path: ${sSnippetJsonPath}`,                
                `=> JSON Parse 오류!!`
            ];

            console.error(error);
            console.error(aConsoleMsg.join("\r\n"));
            
            continue;

        } 

    }

    return aSnippet;  

} // end of _getStandardSnippetData


let oSnippetProvider;

/**********************************************************************
 * Language에 해당하는 스니펫을 설정한다.
 **********************************************************************/
function _setRegisterSnippet(sLanguage){

    if(!sLanguage){
        return;
    }

    // 기존 스니펫 Provider 제거
    if (oSnippetProvider) {
        oSnippetProvider.dispose();
        oSnippetProvider = null;
    }

    // 스니펫 등록하기
    oSnippetProvider = monaco.languages.registerCompletionItemProvider(sLanguage, {
        triggerCharacters: ['f', 'i'],
        provideCompletionItems: function(model, position) {            

            var _snippetData = JSON.parse(JSON.stringify(oAPP.attr.aSnippetData));

            return {
                suggestions: _snippetData
            };                   
        }
    });

} // end of _setRegisterSnippet



window.require([
    'vs/editor/editor.main',
    // 'vs/language/html/htmlWorker'   // ✅ 추가 필요!
    ], function () {

        // TEST -------------- Start
        

        // /**
        //  * Place Holder 작업
        //  */
        // var decorations = [];

        // // Apply a placeholder when the editor is empty
        // const placeholderText = 'Type your code here...';
        // const placeholderDecoration = {
        //     range: new monaco.Range(1, 1, 1, 1),
        //     options: {
        //         isWholeLine: true,
        //         className: 'monaco-placeholder',
        //         glyphMarginClassName: 'monaco-placeholder',
        //         hoverMessage: { value: placeholderText }
        //     }
        // };

        // // Function to update placeholder visibility
        // function updatePlaceholder() {
        //     const model = editor.getModel();
        //     const value = model.getValue();
            
        //     // Remove existing decoration
        //     decorations = editor.deltaDecorations(decorations, []);
            
        //     // Add placeholder if editor is empty
        //     if (!value) {
        //         decorations = editor.deltaDecorations([], [placeholderDecoration]);
        //     }
        // }

        // const style = document.createElement('style');
        // style.textContent = `
        // .cdr.monaco-placeholder::after {
        //     content: "${placeholderText}";
        //     position: absolute;
        //     opacity: 0.6;
        //     pointer-events: none;
        //     white-space: pre;
        // }`;
        // document.head.appendChild(style);


        // TEST -------------- End


        // var path = "C:\\u4a_temp\\U4A USP\\U4A_WS3.0.0-3.5.2-sp3\\www\\lib\\monaco\\snippet\\javascript.json";

        // var js = GRAND_FATHER.require(path);
        
		// // JavaScript 스니펫 등록하기
		// monaco.languages.registerCompletionItemProvider('javascript', {
		// 	provideCompletionItems: function(model, position) {

		// 		var _snippetData = JSON.parse(JSON.stringify(js));

		// 		return {
		// 			suggestions: _snippetData
		// 		};                   
		// 	}
		// });


    //     monaco.editor.defineTheme('vs-dark', 
    //     {

    //       base: 'vs-dark',
    //       inherit: false,
    //       rules: [
    //         { token: '', foreground: 'D4D4D4', background: '1E1E1E' },
    //         { token: 'invalid', foreground: 'f44747' },
    //         { token: 'emphasis', fontStyle: 'italic' },
    //         { token: 'strong', fontStyle: 'bold' },
        
    //         { token: 'variable', foreground: '74B0DF' },
    //         { token: 'variable.predefined', foreground: '4864AA' },
    //         { token: 'variable.parameter', foreground: '9CDCFE' },
    //         { token: 'constant', foreground: '569CD6' },
    //         { token: 'comment', foreground: '#f5e342' },
    //         { token: 'number', foreground: 'B5CEA8' },
    //         { token: 'number.hex', foreground: '5BB498' },
    //         { token: 'regexp', foreground: 'B46695' },
    //         { token: 'annotation', foreground: 'cc6666' },
    //         { token: 'type', foreground: '3DC9B0' },
        
    //         { token: 'delimiter', foreground: 'DCDCDC' },
    //         { token: 'delimiter.html', foreground: '808080' },
    //         { token: 'delimiter.xml', foreground: '808080' },
        
    //         { token: 'tag', foreground: '569CD6' },
    //         { token: 'tag.id.pug', foreground: '4F76AC' },
    //         { token: 'tag.class.pug', foreground: '4F76AC' },
    //         { token: 'meta.scss', foreground: 'A79873' },
    //         { token: 'meta.tag', foreground: 'CE9178' },
    //         { token: 'metatag', foreground: 'DD6A6F' },
    //         { token: 'metatag.content.html', foreground: '9CDCFE' },
    //         { token: 'metatag.html', foreground: '569CD6' },
    //         { token: 'metatag.xml', foreground: '569CD6' },
    //         { token: 'metatag.php', fontStyle: 'bold' },
        
    //         { token: 'key', foreground: '9CDCFE' },
    //         { token: 'string.key.json', foreground: '9CDCFE' },
    //         { token: 'string.value.json', foreground: 'CE9178' },
        
    //         { token: 'attribute.name', foreground: '9CDCFE' },
    //         { token: 'attribute.value', foreground: 'CE9178' },
    //         { token: 'attribute.value.number.css', foreground: 'B5CEA8' },
    //         { token: 'attribute.value.unit.css', foreground: 'B5CEA8' },
    //         { token: 'attribute.value.hex.css', foreground: 'D4D4D4' },
        
    //         { token: 'string', foreground: 'CE9178' },
    //         { token: 'string.sql', foreground: 'FF0000' },
        
    //         { token: 'keyword', foreground: '569CD6' },
    //         { token: 'keyword.flow', foreground: 'C586C0' },
    //         { token: 'keyword.json', foreground: 'CE9178' },
    //         { token: 'keyword.flow.scss', foreground: '569CD6' },
        
    //         { token: 'operator.scss', foreground: '909090' },
    //         { token: 'operator.sql', foreground: '778899' },
    //         { token: 'operator.swift', foreground: '909090' },
    //         { token: 'predefined.sql', foreground: 'FF00FF' },
    //       ],
    //       colors: {
    //         'editor.background': '#1E1E1E',
    //         'editor.foreground': '#D4D4D4',
    //         'editor.InactiveSelection': '#3A3D41',
    //         'editor.IndentGuide1': '#404040',
    //         'editor.ActiveIndentGuide1': '#707070',
    //         'editor.SelectionHighlight': '#ADD6FF26'
    //       }

    //     }

    //   );
          
       /**************


        // 기본 에디터 설정
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false
        });
        
        // 자동완성을 위한 TypeScript 컴파일러 옵션 설정
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES6,
            allowNonTsExtensions: true
        });


        // JavaScript 스니펫 등록하기
        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: function(model, position) {
                const suggestions = [
                    {
                        label: 'for',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'For Loop'
                    },
                    {
                        label: 'forEach',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '${1:array}.forEach((${2:item}) => {\n\t${3}\n});',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'forEach Loop'
                    },
                    {
                        label: 'if',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'if (${1:condition}) {\n\t${2}\n}',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'If Statement'
                    },
                    // 다른 스니펫들 추가
                ];
                
                return {
                    suggestions: suggestions
                };
            }
        });


        ***************/

        // USP의 APP 정보를 구한다.
        let oAppInfo = parent.oAPP.common.fnGetModelProperty("/WS30/APP");
        
        // Edit & Disp 모드 정보
        let bIsEdit = (oAppInfo?.IS_EDIT === "X" ? true : false);

        // 선택된 USP 데이터를 구한다.
        let oSelectedUspLineData = parent.oAPP.fn.getSelectedUspLineData();        

        // 선택된 USP 데이터의 확장자 정보를 구한다.
        let sExtension = oSelectedUspLineData?.EXTEN || "";

        // 선택된 USP 데이터의 랭귀지 정보를 구한다.
        let sLanguage = "";
        
        // // 확장자별 에디터의 Language 정보
        // let aLanguConv = [
        //     { ext: "js", langu: "javascript" },
        //     { ext: "mjs", langu: "javascript" },
        //     { ext: "cjs", langu: "javascript" },
        //     { ext: "ts", langu: "typescript" },
        //     { ext: "tsx", langu: "typescript" },
        //     { ext: "css", langu: "css" },
        //     { ext: "scss", langu: "scss" },
        //     { ext: "less", langu: "less" },
        //     { ext: "markdown", langu: "md" },
        //     { ext: "shell", langu: "sh" },
        //     { ext: "bash", langu: "bash" },
        //     { ext: "htm", langu: "html" },
        //     { ext: "html", langu: "html" },
        //     { ext: "xml", langu: "xml" },
        //     { ext: "svg", langu: "svg" },
        //     { ext: "txt", langu: "text" },
        //     { ext: "json", langu: "json" },
        //     { ext: "py", langu: "python" },
        // ];

        // var oLanguage = aLanguConv.find(e => e.ext === sExtension) || "";
        // if(oLanguage){
        //     sLanguage = oLanguage.langu;
        // }

        var oLanguage = getMonacoLanguage(sExtension);
        if(oLanguage){
            sLanguage = oLanguage.langu;
        }

        oAPP.attr.snippetLanguage = sLanguage;
        
        

    /***********************************************************************
     * ➡️ 스니펫 설정
     ***********************************************************************/

        // Language에 해당하는 스니펫을 구성
        _setSnippetConfig(sLanguage);

        // 스니펫을 등록한다.
        _setRegisterSnippet(sLanguage);

    /***********************************************************************
     * ➡️ Editor 랜더링
     ***********************************************************************/
        
        window.editor = monaco.editor.create(document.getElementById('content'), {
            value: oSelectedUspLineData?.CONTENT || "",
            language: sLanguage,
            readOnly: !bIsEdit,
            //domReadOnly: 숨은 textarea 에 readonly 부여 → readOnly 만으론 뚫리는 IME(한글) 조합 입력 차단(Chromium93).
            domReadOnly: !bIsEdit,
            theme: 'vs-dark',
            glyphMargin: true,
            automaticLayout: true,
            tabCompletion: 'on',  // 탭 완성 활성화
            snippetSuggestions: 'inline',  // 스니펫 제안 표시 방법
            automaticLayout: true,
            formatOnPaste: false,
            formatOnType: false,
            wordWrap: "off", // ✅ 줄 바꿈 끄기 → 가로 스크롤 생김!

            scrollbar: {
                verticalScrollbarSize: 7,
                horizontalScrollbarSize: 7,
                // handleMouseWheel: true,
                alwaysConsumeMouseWheel: false
            }

        });

    /***********************************************************************
     * ✅ 테마 전체 목록을 바인딩 한다.
     ***********************************************************************/   

        // Monaco Editor의 테마 정보(스탠다드 & 커스텀) 목록을 구한다.
        let aThemeList = GRAND_FATHER.WSUTIL.MONACO_EDITOR.getThemeList();        

        let oUspEditorModel = parent.oAPP.common.fnGetModelProperty("/WS30/USP_EDITOR");
        if(!oUspEditorModel){
            parent.oAPP.common.fnSetModelProperty("/WS30/USP_EDITOR", {});
        }

        parent.oAPP.common.fnSetModelProperty("/WS30/USP_EDITOR/aThemeList", aThemeList);


    /***********************************************************************
     * ✅ 기 저장된 테마가 있을 경우 해당 테마로 설정하기
     ***********************************************************************/  

        // UI5 테마 정보
        let sUi5Theme = parent.sap.ui.getCore().getConfiguration().getTheme();

        // 기본 테마 설정
        let sThemeName = "vs-light";

        // 마지막 선택된 에디터 테마 정보
        let oLastSelectedThemeInfo = parent.oAPP.usp.getLastSelectedEditorTheme();
        let sLastThemeName = oLastSelectedThemeInfo?.themeName;

        // 마지막 테마가 존재하고, 테마 목록에 있으면 적용
        if (sLastThemeName && aThemeList.some(e => e.name === sLastThemeName)) {
            sThemeName = sLastThemeName;
        }
        // 없으면 UI5 테마가 다크면 vs-dark 적용
        else if (sUi5Theme.endsWith("dark")) {
            sThemeName = "vs-dark";
        }

        setApplyTheme(sThemeName);

        // 마지막 선택한 테마 정보를 모델에 세팅
        parent.oAPP.common.fnSetModelProperty("/WS30/USP_EDITOR/sSelectedTheme", sThemeName);



    /***********************************************************************
     * ✅ 라이브 Editor 체인징
     ***********************************************************************/

        // 외부에서 업데이트를 했는지의 Flag
        editor.bExternalUpdated = false;
        
        editor.onDidChangeModelContent((event) => {
            
            // TEST --------- Start
            // updatePlaceholder();
            // TEST --------- End

            // 외부에서 업데이트가 되어서 Change 이벤트가 발생했을 경우에는 하위로직 수행 하지 않고 빠져나간다.            
            if(editor.bExternalUpdated === true){
                editor.bExternalUpdated = false;
                return;
            }

            // 여기서 Post Message 쏘는 로직 추가..
            if(oAPP.MESSAGE_CHANEL_PORT){

                oAPP.MESSAGE_CHANEL_PORT.postMessage(editor.getValue());

            }

            // 부모 영역에 에디터 데이터를 모델에 업데이트
            let oMsgEvt = new MessageEvent("IF_USP_EDITOR", { data: { ACTCD: "CONTENT_SYNC", CONTENT: editor.getValue() } });
            if(oAPP?.attr?.oCustomEvtDom){
                oAPP.attr.oCustomEvtDom.dispatchEvent(oMsgEvt);
            }

          
            // const currentCode = editor.getValue();
            // console.log("✍️ 코드 변경됨:");

            // //변경 포지션 정보 시작라인,시작컬럼
            // event.changes.forEach(change => {
            //     console.log("변경 범위:", change.range);
            //     console.log("변경된 텍스트:", change.text);
            // });

        });



    /***********************************************************************
     * ✅ Ctrl + 마우스 휠 이벤트 처리
     ***********************************************************************/   

        //✅ font 기본 사이즈
        const DEFAUT_FONT_SIZE = 14;

        //✅ Ctrl + 마우스 휠로 폰트 크기 제어
        let currentFontSize = DEFAUT_FONT_SIZE;
        const MIN_FONT_SIZE = 10;
        const MAX_FONT_SIZE = 50;

        // ✅ Ctrl + 마우스 휠 이벤트 처리
        editor.getDomNode().addEventListener('wheel', function (e) {
            if (e.ctrlKey) {
                e.preventDefault(); // 브라우저 기본 확대 방지

                if (e.deltaY < 0 && currentFontSize < MAX_FONT_SIZE) {
                    currentFontSize++;
                } else if (e.deltaY > 0 && currentFontSize > MIN_FONT_SIZE) {
                    currentFontSize--;
                }

                editor.updateOptions({ fontSize: currentFontSize });
            }
        }, { passive: false }); // ❗ passive: false → preventDefault() 허용


        // 에디터 텍스트 사이즈 기본값 설정
        editor.setDefaultFontSize = function(){

            currentFontSize = DEFAUT_FONT_SIZE;
            
            editor.updateOptions({ fontSize: DEFAUT_FONT_SIZE });

        };


    /***********************************************************************
     * ✅ 단축키
     ***********************************************************************/         

        // const pressedKeys = new Set();

        editor.onKeyDown((e) => {            

            let oEvent = e?.browserEvent || undefined;
            if(!oEvent){
                return;
            }

            let sCode = oEvent.code;
            
            // console.log(`code: ${sCode}`);
            
            // 에디터에 키를 눌렀을 때 예약된 단축키가 존재할 경우 부모에 있는 단축키 기능을 수행한다.
            let oFindKeyBinding = aReservedShortcutList.find(function(oKeyInfo){

                if(!oKeyInfo){
                    return;
                }

                let oKeyb = oKeyInfo?.keyBinding || undefined;
                if(!oKeyb){
                    return false;
                }

                if( (oKeyb.altKey === oEvent.altKey) && 
                    (oKeyb.ctrlKey === oEvent.ctrlKey) && 
                    (oKeyb.shiftKey === oEvent.shiftKey) && 
                    (oKeyb.code === oEvent.code) ){

                    return true;

                }

                return false;

            });

            if(!oFindKeyBinding){
                return;
            }

            // USP에 적용된 단축키 전체 정보를 구한다.
            let aShortCutList = parent.oAPP.common.getShortCutList("WS30");
            if(!aShortCutList || Array.isArray(aShortCutList) === false || aShortCutList.length === 0){
                return;
            }

            // 단축키 정보 중, USP에 적용된 단축키와 동일한 정보를 찾는다.
            let oSaveShortcutInfo = aShortCutList.find(e => e.KEY === oFindKeyBinding.keyBindingName);
            if(!oSaveShortcutInfo){
                return;
            }

            if(typeof oSaveShortcutInfo?.fn !== "function"){
                return;
            }

            oSaveShortcutInfo.fn(event);

            var _ointer = setInterval(() => {
    
                if(parent.sap.ui.getCore().isLocked()){ return; }

                clearInterval(_ointer);

				setTimeout(function(){
					editor.focus();                
				},0);               
                
              
            }, 0);

        });

        // // 키 해제
        // editor.onKeyUp((e) => {
            

        // });

        // 폰트 기본사이즈 변경
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () => {      
            editor.setDefaultFontSize();
        });


        // 단축키 동작 금지 대상 ---
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F3, () => {});
        editor.addCommand(monaco.KeyCode.F3, () => {});




    /***********************************************************************
     * ✅ 우클릭 이벤트 설정
     ***********************************************************************/           
        editor.onContextMenu((e) => {

            let oEditorEvent = e?.event;
            if(!oEditorEvent){
                return;
            }

            //브라우저 우클릭 메뉴 막기
            oEditorEvent.preventDefault();
            oEditorEvent.stopPropagation(); // ← 선택적으로 추가

            let oEvent = oEditorEvent?.browserEvent;
            if(!oEvent){
                return;
            }

            // console.log(`clientX: ${oEvent.clientX}, clientY: ${oEvent.clientY}`);
            // console.log(`x: ${oEvent.x}, y: ${oEvent.y}`);
            

            // 필요 정보..
            // 1. editor
            // 2. page

            let oParams = {
                oEditor: editor,             // 모나코 에디터 객체
                // PAGEID: oAPP.attr.PAGEID, // 현재 페이지 ID
                sPageId: oAPP.attr.PAGEID,   // 현재 페이지 ID
                oMonaco: monaco              // 모나코 객체
            };

            // [asyc]            
            parent.oAPP.fn.onEditorContextMenu(oEvent, oParams);

            // const selection = editor.getSelection();
            // const selectedText = editor.getModel().getValueInRange(selection);
            // console.log('선택된 텍스트:', selectedText);
  
        });



		// 에디터 영역 컨텍스트 메뉴 닫기
		function _closeCtxMenu(){

			if(!parent?.sap){
				return;
			}

			let sCtxMenuId = "uspCDECtxMenu";
			let oCtxMenu = parent.sap.ui.getCore().byId(sCtxMenuId);
			if(!oCtxMenu){
				return;
			}

			oCtxMenu.close();

		} // end of _closeCtxMenu
		
    /***********************************************************************
     * ✅ 마우스 다운 이벤트
     ***********************************************************************/  
		
		editor.onMouseDown((e) => {
			
			// 에디터 영역 컨텍스트 메뉴 닫기
			_closeCtxMenu();

			// console.log('마우스 다운 이벤트 발생:', e);
			// // 클릭된 위치의 좌표, 타겟 등에 접근 가능
			// const position = e.target.position;
			// // 여기서 원하는 작업 수행
		});



        //✅ 우클릭 기본 탑재 메뉴 끄기
        editor.updateOptions({
            contextmenu: false // ✅ 기본 메뉴 끄기 false
        });



		// // ✅ 포커스 IN (에디터에 진입했을 때)
		// editor.onDidFocusEditorText(() => {
		// 	console.log("📌 에디터 포커스 IN");
		// });
		
		// // ✅ 포커스 OUT (에디터 밖으로 나갔을 때)
		// editor.onDidBlurEditorText(() => {
		// 	console.log("📤 에디터 포커스 OUT");
		// });











        // 에디터가 로드 완료되었다고 부모에게 알려준다.
        let oMsgEvt = new MessageEvent("IF_USP_EDITOR", { data: { ACTCD: "EDITOR_LOAD" } });
        if(oAPP?.attr?.oCustomEvtDom){
            oAPP.attr.oCustomEvtDom.dispatchEvent(oMsgEvt);
        }

        return;



   
        //✅ 스크롤 옵션 설정
        editor.updateOptions({
            scrollbar: {
              verticalScrollbarSize: 7,  // 세로 스크롤 두께
              horizontalScrollbarSize: 7, // 가로 스크롤 두께
            //   handleMouseWheel: true,
              alwaysConsumeMouseWheel: false
            }
        });


        // ✅ 테마 동적 변경

        var themeList = ['vs', 'vs-dark', 'hc-black']  //현재 테마 리스트 - 자체적으로 관리는 않함 개인적으로 관리해야함 

        //var _theme = editor._themeService._theme.themeData.base;  //<-- 현재 적용된 테마 
        monaco.editor.setTheme('vs'); // 밝은 테마
        monaco.editor.setTheme('vs-dark'); // 어두운 테마


        // //✅ 주석 동적 처리
        //      현재 _theme = editor._themeService._theme.themeData.base
                // 읽어서 _theme + "user" 명으로 해서 아래 로직을 동적으로 생성하고 수행해야할듯
        // monaco.editor.defineTheme('custom-theme', {
        //     base: 'vs-dark', // or 'vs'
        //     inherit: true,
        //     rules: [
        //       { token: 'comment', foreground: 'ff5555', fontStyle: 'italic' }
        //     ],
        //     colors: {}
        //   });
          
        // monaco.editor.setTheme('custom-theme');


        //✅ 테마 변경 이벤트
        const themeService = editor._themeService;
        themeService.onDidColorThemeChange((newTheme) => {
          console.log("🎨 테마가 변경됨:", newTheme.themeName);
          // 원하는 로직 실행
        });



        // ✅ 라인 숫자 옆 아이콘 설정 
        // const decorations = editor.deltaDecorations([], [
        //     {
        //       range: new monaco.Range(2, 1, 2, 1), // 2번째 줄
        //       options: {
        //         isWholeLine: true,
        //         glyphMarginClassName: 'my-icon-gutter' // 커스텀 클래스 삽입
        //       }
        //     }
        // ]);



        // //✅ 특정 Line 디자인 설정
        // editor.deltaDecorations([], [
        //     {
        //       range: new monaco.Range(2, 1, 3, 1), // 3번째 줄 전체
        //       options: {
        //         isWholeLine: true,
        //         className: 'my-line-highlight' // ✅ CSS로 처리할 클래스
        //       }
        //     }
        // ]);


        //✅ 우클릭 이벤트 설정
        editor.onMouseDown((e) => {
            if (e.event.rightButton) {
               
                //e.target.element  <-- dom 오브젝트
                const position = e.target.position;

                console.log('🖱️ 우클릭 위치:', position);
                console.log('🖱️ 우클릭 위치:', e.target.element);
          
            }
        });

        //✅ 우클릭 기본 탑재 메뉴 끄기
        editor.updateOptions({
            contextmenu: false // ✅ 기본 메뉴 끄기 false
        });


        //✅ 우클릭 기본 메뉴에 메뉴 추가
        //   서브 메뉴 지원않함!!!
        editor.addAction({
            id: 'explain-with-ai',
            label: '🧠 커스텀 메뉴 추가!!!!',
            // contextMenuGroupId: 'navigation',
            contextMenuGroupId: '1_shhong',
            contextMenuOrder: 1, //그룹 내 위치 (작을수록 위에)
            run: function(ed) {
                const selection = ed.getSelection();
                const selectedText = ed.getModel().getValueInRange(selection);
                alert('🧠 선택한 코드:\n' + selectedText);
            }
        });



        // //✅ Editor 영역 잠금/해제 처리 
        // editor.updateOptions({
        //     readOnly: false    
        // });        

        // //Editor 잠김 상태 여부 
        // editor.getOption(monaco.editor.EditorOption.readOnly);


        //✅ 현재 커서 위치 가져오기
        const position = editor.getPosition();
        console.log("현재 줄:", position.lineNumber);
        console.log("현재 칼럼:", position.column);

        //✅ 현재 커서 위치 이동 
        editor.setPosition({ lineNumber: 5, column: 1 }); // 5번째 줄, 첫 번째 칼럼로 이동
        editor.focus(); // 커서 반짝이게 하려면 focus도 같이


        //✅ 현재 커서 자동 감지하려면 (커서가 이동할 때마다)
        editor.onDidChangeCursorPosition((e) => {
            const pos = e.position;
            console.log(`📍 커서 위치 → 줄 ${pos.lineNumber}, 칼럼 ${pos.column}`);
        });



        //✅ 선택된 영역의 텍스트 가져오기
        const selection = editor.getSelection();
        const selectedText = editor.getModel().getValueInRange(selection);
        console.log("📋 선택된 텍스트:\n", selectedText);
        
        //✅ 특정 영역 블럭 선택 처리 1, 1 → 4번째 줄의 첫 번째 문자
        editor.setSelection(new monaco.Range(1, 1, 4, 1));
        editor.focus();


        //✅ 선택된 영역 자동 감지하려면 (선택 바뀔 때마다)
        editor.onDidChangeCursorSelection((e) => {

            const range = e.selection;
            const text = editor.getModel().getValueInRange(range);

            if (text) {
              console.log("🔸 선택됨:", text);
            }

            if (text.trim().length > 0) {
                console.log("🔸 선택됨:", text);
            } 
            
        });


        //✅ 미니맵 켜기/끄기 
        editor.updateOptions({
            minimap: { enabled: true }  //false 끄기
        });

        //✅ 미니맵 설정 전체 예시
        editor.updateOptions({
            minimap: {
              enabled: true,              // 켜기/끄기
              side: 'right',              // 'right' or 'left'
              size: 'proportional',       // 'proportional' | 'fill' | 'fit'
              renderCharacters: true,     // true면 실제 코드 모양 렌더링
              showSlider: 'mouseover'        // 'always' or 'mouseover'
            }
        });


        //✅ 텍스트 붙여넣기 
        editor.onDidPaste((event) => {
            console.log("붙여넣은 내용:", event.range);
        });


        // ✅ 외부 드래그 처리 (예: 텍스트 끌어오기)
        (()=>{

            const container = editor.getDomNode();

            container.addEventListener('dragover', (e) => {
              e.preventDefault(); // 기본 동작 막기
            });
            
            container.addEventListener('drop', (e) => {
              e.preventDefault();
            
              const text = e.dataTransfer.getData('text/plain');
              const position = editor.getPosition();

              editor.executeEdits('', [
                {
                  range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                  text: text,
                  forceMoveMarkers: true
                }
              ]);
            
              editor.focus();
    
            });

        })();


        // ✅ 로컬PC 파일 드롭 
        (()=>{
        
            const container = editor.getDomNode();

            // 🔁 드래그 오버 시 기본 동작 막기
            container.addEventListener('dragover', function (e) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            });
            
            // 📥 드롭 이벤트 처리
            container.addEventListener('drop', function (e) {
              e.preventDefault();
            
              const file = e.dataTransfer.files[0];
              if (!file) return;
                
              //파일 확장자 필터
              if (!file.name.endsWith('.txt') && !file.name.endsWith('.js')) {
                alert("지원하지 않는 파일 형식입니다.");
                return;
              }

              const reader = new FileReader();
            
              reader.onload = function (event) {
                const text = event.target.result;
                editor.setValue(text); // 📌 Monaco Editor에 텍스트 삽입
              };
            
              reader.readAsText(file); // 📥 파일 내용 읽기
            });

        })();


        // ✅ 꾸밈프린트
        editor.getAction('editor.action.formatDocument').run();


        // ✅ 꾸밈프린트 - 커스텀 ? 확인 다시 해야함!!!!!!!!!!!
        monaco.languages.register({ id: 'html' });
        monaco.languages.registerDocumentFormattingEditProvider('html', {
            provideDocumentFormattingEdits: function(model, options, token) {
              console.log('📦 포맷 요청 들어옴!');
              const original = model.getValue();
              const formatted = original.toUpperCase(); // 그냥 대문자로 바꾸는 테스트
          
              return [
                {
                  range: model.getFullModelRange(),
                  text: formatted
                }
              ];
            }
        });


        // ✅ 언어 변경 방법 (실행 중에 변경)
        monaco.editor.setModelLanguage(editor.getModel(), 'javascript');


   


        // ✅ 코드 액션이 동작하는 설정
        editor.updateOptions({
            lightbulb: {
              enabled: true
            }
        });

        // ✅ 코드 액션 - 에디터 상에 전구아이콘 클릭시 callback 메뉴 팝업처리
        monaco.languages.registerCodeActionProvider('javascript', {
            provideCodeActions: function(model, range, context, token) {
              return {
                actions: [
                  {
                    title: '💡 이 줄을 콘솔로 출력하기',
                    kind: 'quickfix',
                    diagnostics: [],
                    edit: {
                      edits: [
                        {
                          resource: model.uri,
                          edit: {
                            range: range,
                            text: `console.log(${model.getValueInRange(range)});`
                          }
                        }
                      ]
                    },
                    isPreferred: true
                  }
                ],
                dispose: () => {}
              };
            }
        });


        // ✅ 예제: 특정 키워드에 툴팁 달기
        monaco.languages.registerHoverProvider('javascript', {
            provideHover: function(model, position) {
              const wordInfo = model.getWordAtPosition(position);
              if (!wordInfo) return;
          
              const word = wordInfo.word;
          
              // 예시: 특정 단어에만 툴팁 표시
              if (word === 'ttt') {
                return {
                  range: new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn),
                  contents: [
                    { value: '**ttt 변수**' },
                    { value: '메롱메롱메롱' }
                  ]
                };
              }
            }
        });
          

        //✅ Monaco Hover UI를 끄고, 직접 HTML 요소로 툴팁을 만들기"
        // function showCustomTooltip(x, y, html) {
        //     const tooltip = document.getElementById('custom-tooltip');
        //     tooltip.innerHTML = html;
        //     tooltip.style.left = `${x + 10}px`;
        //     tooltip.style.top = `${y + 10}px`;
        //     tooltip.style.display = 'block';
        // }

        // function hideCustomTooltip() {
        //     document.getElementById('custom-tooltip').style.display = 'none';
        // }

        // editor.onMouseMove((e) => {
        //     const pos = e.target.position;
        //     const word = editor.getModel().getWordAtPosition(pos);
          
        //     if (word?.word === 'ttt') {
        //       showCustomTooltip(e.event.browserEvent.pageX, e.event.browserEvent.pageY, '<b>HTML 툴팁</b>');
        //     } else {
        //       hideCustomTooltip();
        //     }
        // });


        //Monaco Editor 내부에 결과 박스 삽입하기
        const outputWidget = {
            domNode: null,
          
            getId: function () {
              return 'my.custom.inline.output';
            },
          
            getDomNode: function () {
              if (!this.domNode) {
                this.domNode = document.createElement('div');
                this.domNode.style.background = '#222';
                // this.domNode.style.border = '2px solid black';
                // this.domNode.style.border = '3px dashed red'; // 점선 빨간색 테두리
                this.domNode.style.border = '3px solid red'; // 점선 빨간색 테두리
                // this.domNode.style.width = "100%";
                this.domNode.style.color = 'white';
                this.domNode.style.padding = '6px 12px';
                this.domNode.style.borderRadius = '6px';
                this.domNode.style.marginTop = '1px';
                this.domNode.innerText = '📤 FIX 라인 ==================================';
              }
              return this.domNode;
            },
          
            getPosition: function () {
              return {
                position: {
                  lineNumber: 1,
                  column: 50
                },
                preference: [
                  monaco.editor.ContentWidgetPositionPreference.BELOW
                ]
              };
            }
          };


        editor.addContentWidget(outputWidget);





});
