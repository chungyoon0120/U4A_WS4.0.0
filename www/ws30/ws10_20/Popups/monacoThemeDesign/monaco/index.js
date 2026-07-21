

window.require.config({
    paths: {
      // 'vs': './vs'   // ✅ 정확한 상대 경로
      'vs': parent.oAPP.views.VW_MAIN.attr.monacoVSPath   // ✅ 정확한 상대 경로
    }
});


// https://github.com/microsoft/vscode/blob/main/extensions/javascript/snippets/javascript.code-snippets


window.require([
    'vs/editor/editor.main',
    // 'vs/language/html/htmlWorker'   // ✅ 추가 필요!
    ], async function () {

        monaco.editor.defineTheme('u4a-dark-pastel', {
            base: 'vs-dark', // or 'vs' for 밝은 베이스
            inherit: true,
            rules: [
              { token: 'comment', foreground: 'FFFF00', fontStyle: 'italic' },
              { token: 'keyword', foreground: 'C792EA' },
              { token: 'number', foreground: 'F78C6C' },
              { token: 'string', foreground: 'ECC48D' },
              { token: 'operator', foreground: '89DDFF' },
              { token: 'variable', foreground: '82AAFF' },
              { token: 'type', foreground: 'FFCB6B' },
              { token: 'function', foreground: '80CBC4' }
            ],
            colors: {
              'editor.background': '#0F111A',          // 아주 어두운 배경
              'editor.foreground': '#D0D0D0',          // 기본 텍스트
              'editorLineNumber.foreground': '#3A3F4B',
              'editorLineNumber.activeForeground': '#C792EA',
              'editor.selectionBackground': '#2A2D3E',
              'editor.inactiveSelectionBackground': '#2A2D3E88',
              'editorCursor.foreground': '#FFCC00',
              'editorWhitespace.foreground': '#3A3F4B',
              'editorIndentGuide.background': '#2C313A',
              'editorIndentGuide.activeBackground': '#C792EA',
              'editor.lineHighlightBackground': '#1E1E1E50'
            }
        });


        if(oAPP.attr.initThemeName !== "" && typeof oAPP.attr.initThemeData !== "undefined"){
          monaco.editor.defineTheme(oAPP.attr.initThemeName, oAPP.attr.initThemeData);
        }
        

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


        // Editor 랜더링
        window.editor =  monaco.editor.create(document.getElementById('container'), {
            // value: 'var ttt = ""; \n\n\n',
            value: '',
            language: 'javascript',
            theme: 'vs-dark',
            // ✅ Monaco 자체 우클릭 메뉴 비활성(공통 에디터 호스트 editorPopup/host 와 동일).
            //    frameless 창에서 메뉴 DOM 이 -webkit-app-region 을 서브프레임에 등록해
            //    부모 타이틀바 드래그가 죽는 문제 예방.
            contextmenu: false,
            glyphMargin: true,
            automaticLayout: true,
            tabCompletion: 'on',  // 탭 완성 활성화
            quickSuggestions: true,
            // snippetSuggestions: 'inline',  // 스니펫 제안 표시 방법
            snippetSuggestions: 'top',  // 스니펫 제안 표시 방법
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            wordWrap: "off", // ✅ 줄 바꿈 끄기 → 가로 스크롤 생김!
            scrollbar: {
                verticalScrollbarSize: 7,
                horizontalScrollbarSize: 7,
                // handleMouseWheel: true,
                alwaysConsumeMouseWheel: false
            }

        });


        //placeholder
        const placeholder = {
          domNode: null,
          getId: () => 'placeholder.widget',
          getDomNode: function() {
        
            if (!this.domNode) {
              this.domNode = document.createElement('div');
              //340	Enter HTML, JavaScript, or CSS code to check the applied editor theme.
              this.domNode.innerText = parent.oAPP.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "340");
              this.domNode.style.opacity = '0.5';
              this.domNode.style.position = 'absolute';
              this.domNode.style.paddingRight = '70px';

              // this.domNode.style.top = '0px';
              // this.domNode.style.left = '90px';
              this.domNode.style.pointerEvents = 'none';
            }
            return this.domNode;
          },
          getPosition: () => null,
        };

        editor.addOverlayWidget(placeholder);

        // 입력 감지해서 placeholder 숨김
        editor.onDidChangeModelContent(() => {
          const value = editor.getValue();
          placeholder.domNode.style.display = value ? 'none' : 'block';
        });


        function updatePlaceholderStyle() {
          const fontSize = editor.getOption(monaco.editor.EditorOption.fontSize);
          placeholder.domNode.style.fontSize = fontSize + 'px';
        }
        
        editor.onDidChangeConfiguration((e) => {
          if (e.hasChanged(monaco.editor.EditorOption.fontSize)) {
            updatePlaceholderStyle();
          }
        });
        
        // 초기에도 한 번 설정
        updatePlaceholderStyle();


        function updatePlaceholderPosition() {
          const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
          const coords = editor.getScrolledVisiblePosition(pos);
          if (coords) {
            placeholder.domNode.style.top = `${coords.top}px`;
            placeholder.domNode.style.left = `${coords.left}px`;
          }
        }
        
        // 에디터가 스크롤되거나 리사이즈될 때마다 위치 업데이트
        editor.onDidScrollChange(updatePlaceholderPosition);
        editor.onDidLayoutChange(updatePlaceholderPosition);
        editor.onDidChangeCursorPosition(updatePlaceholderPosition);
        

        updatePlaceholderPosition();
        



        // editor 인스턴스에 커스텀 속성 주입
        editor._isExternalUpdate = false;


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

        // var themeList = ['vs', 'vs-dark', 'hc-black']  //현재 테마 리스트 - 자체적으로 관리는 않함 개인적으로 관리해야함 

        //var _theme = editor._themeService._theme.themeData.base;  //<-- 현재 적용된 테마 
        // monaco.editor.setTheme('vs'); // 밝은 테마
        // monaco.editor.setTheme('vs-dark'); // 어두운 테마
        if(oAPP.attr.initThemeName !== ""){
          monaco.editor.setTheme(oAPP.attr.initThemeName);
        }


        //✅ 테마 변경 이벤트
        const themeService = editor._themeService;
        themeService.onDidColorThemeChange((newTheme) => {
          // console.log("🎨 테마가 변경됨:", newTheme.themeName);
          // 원하는 로직 실행
        });


        //✅ Ctrl + 마우스 휠로 폰트 크기 제어
        let currentFontSize = 14;
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


        // ✅ 언어 변경 방법 (실행 중에 변경)
        monaco.editor.setModelLanguage(editor.getModel(), 'javascript');


        // ✅ 코드 액션이 동작하는 설정
        editor.updateOptions({
            lightbulb: {
              enabled: true
            }
        });

});
