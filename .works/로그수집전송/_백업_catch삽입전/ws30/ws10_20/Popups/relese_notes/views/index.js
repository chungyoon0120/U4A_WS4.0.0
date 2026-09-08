
"use strict";

const remote = require("@electron/remote");
const ipcMain = remote.ipcMain;


/** ───────────────────────────────────────
 * 🧠 Class: ReleaseApp
 //#region ReleaseApp
 * ----------------------------------------
 * 🔹 - OOP Class Architecture
 * 🔹 - Virtual Scroll (DOM Pruning)
 * 🔹 - Callback-based Event Handling
*/
class ReleaseApp {
    constructor() {
        this.remote = require('@electron/remote');
        this.remoteWindow = this.remote.getCurrentWindow();
        this.ipcRenderer  = require('electron').ipcRenderer;
          
        //파라메터 
        this.if_data = this.getParams();

        //접속 처리 언어
        this.language = this?.if_data?.language || 'EN';
        this.language = this.language.toUpperCase();

        // data 컨트롤 제어 인스턴스 초기화 
        this.dataManager = new DataManager();

        // WS3.0 유틸 객체 로드
        try {
            const _path = this.remote.require("path");
            const _pathinfo = require(_path.join(this.remote.app.getAppPath(), "ws30", "resources", "pathInfo.js"));
            window.WSUTIL = require(_pathinfo.WSUTIL);

        } catch (error) {
            
            //😡 개별 실행용 메시지 유틸 객체
            // - 메인 프로젝트와 통합되면 공통 WSUTIL 을 사용하므로 이 영역은 개발/테스트용 대체 로직이다.
            // - 분리 개발 환경에서도 기존과 동일하게 getWsMsgClsTxt(...) 형태로 호출할 수 있도록 맞춘다.
            window.WSUTIL = {
                getWsMsgClsTxt : function(lan, MSGID, MSGNO ){
                    //html 에 찾는 방법 -> vscode find -> data-msg-
                    //js 에 찾는 방법 -> vscode find -> msgid 로 찾는다 
                    //#region 😡반드시!!!! 확인해야함
                    var rawMessages = {
                        'KO': [
                            { msgid: "550", msgtx: "오류코드" },
                            { msgid: "551", msgtx: "동일한 문제가 계속 발생하면 담당자에게 문의해 주세요." },
                            { msgid: "552", msgtx: "잠시 후 다시 시도해 주세요." },
                            { msgid: "553", msgtx: "요청을 처리하는 중 문제가 발생했습니다." },
                            { msgid: "554", msgtx: "요청 시간이 초과되었습니다." },	
                            { msgid: "555", msgtx: "테마 변경" },
                            { msgid: "556", msgtx: "데이터를 안전하게 불러오는 중입니다" },
                            { msgid: "557", msgtx: "전체 초기화" },
                            { msgid: "558", msgtx: "알림" },
                            { msgid: "559", msgtx: "내용을 확인해주세요" },
                            { msgid: "002", msgtx: "확인" },
                            { msgid: "560", msgtx: "버전 / 내용 검색" },
                            { msgid: "561", msgtx: "연도 필터" },
                            { msgid: "562", msgtx: "처리 오류" },
                            { msgid: "563", msgtx: "도움말 문서를 준비하는 중입니다." },
                        ],
                        'EN': [
                            { msgid: "550", msgtx: "Error Code" },
                            { msgid: "551", msgtx: "If the same problem continues, please contact your administrator." },
                            { msgid: "552", msgtx: "Please try again later." },
                            { msgid: "553", msgtx: "An error occurred while processing the request." },
                            { msgid: "554", msgtx: "The request has timed out." },
                            { msgid: "555", msgtx: "Change theme" },
                            { msgid: "556", msgtx: "Loading data securely" },
                            { msgid: "557", msgtx: "Reset All" },
                            { msgid: "558", msgtx: "Notification" },
                            { msgid: "559", msgtx: "Please check the content" },
                            { msgid: "002", msgtx: "Confirm" },                            
                            { msgid: "560", msgtx: "Version / Content Search" },
                            { msgid: "561", msgtx: "Year Filter" },
                            { msgid: "562", msgtx: "Processing Error" },
                            { msgid: "563", msgtx: "Preparing help documentation..." }
                        ]
                    };

                    var aaa = rawMessages[lan].filter(e => e.msgid === MSGNO);

                    return aaa[0]?.msgtx || "";
                    //#endregion

                }
            }

        }


        //출력 dom 에 번역 
        i18n.applyTranslation(this.language);

        
        // 사용자가 마지막에 사용한 테마 로드
        const _Theme = this.if_data?.theme || 'dark';
        this.themeManager = new ThemeManager(_Theme);
        this.state = { search: '', year: null, filtered: [], renderedCount: 0, allData: [] };

        // 브라우저 렌더링 엔진에 스타일 적용 시간 대기 
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {

                if (this.remoteWindow) {

                    // 창을 활성
                    this.remoteWindow.show();

                    // 초기 설정 
                    this.init();

                }
            });
        });

    }

    getParams(){
      const _params = new URLSearchParams(window.location.search);
      const _raw = _params.get("options");
      if (!_raw) return {};
      try {
        return JSON.parse(decodeURIComponent(_raw));
      } catch {
        return {};
      }

    }


    async init() {
        try {
            // 데이터 로딩 시뮬레이션 및 호출
            const raw = await this.dataManager.fetchData();
      
            this.state.allData = this.dataManager.process(raw);
            
            this.renderEngine = new RenderEngine(this);
            this.bindEvents();
            this.renderEngine.renderFilters();
            this.applyFilter();
            
            // 로딩 화면 제거
            const loader = document.getElementById('loadingArea');
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => loader.style.display = 'none', 500);
            }
            
            document.getElementById('searchInput').disabled = false;
        } catch (e) {
            console.error("Initialization Failed:", e);
        }
    }

    bindEvents() {
        const input = document.getElementById('searchInput');
        const clear = document.getElementById('searchClear');
        const vp = document.getElementById('viewport');
        const top = document.getElementById('scrollTop');

        // 검색 로직
        input.addEventListener('input', (e) => {
            const v = e.target.value.trim();
            clear.classList.toggle('show', v.length > 0);
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => { this.state.search = v; this.applyFilter(); }, 300);
        });

        clear.onclick = () => { input.value = ''; clear.classList.remove('show'); this.state.search = ''; this.applyFilter(); };

        // 스크롤 이벤트
        vp.onscroll = () => top.classList.toggle('show', vp.scrollTop > 400);
        top.onclick = () => vp.scrollTo({ top: 0, behavior: 'smooth' });

        // 🚀 신규 기능 버튼 클릭 (이벤트 위임 및 콜백)
        document.getElementById('timeline').addEventListener('click', (e) => {
            const btn = e.target.closest('.feature-btn');
            if (!btn) return;
            this.onFeatureButtonClick(btn.dataset.path, btn.dataset.version);
        });


        // 🚀 윈도우 타이틀 제어 
        const minBtn = document.getElementById('min-btn');
        const maxBtn = document.getElementById('max-btn');
        const closeBtn = document.getElementById('close-btn');

        // 최소화
        minBtn.addEventListener('click', () => {
            this.remoteWindow.minimize();
        });

        // 최대화 / 복원 (토글)
        maxBtn.addEventListener('click', () => {
           
            if (this.remoteWindow.isMaximized()) {
                this.remoteWindow.unmaximize();
            } else {
                this.remoteWindow.maximize();
            }

        });

        // 닫기
        closeBtn.addEventListener('click', () => {
            this.remoteWindow.close();
        });


        // ── 창 상태에 따른 아이콘 변경 리스너 ──
        const updateMaxBtnIcon = () => {
            const maxBtn = document.getElementById('max-btn');
            if (this.remoteWindow.isMaximized()) {
                // 복원 아이콘: 뒤에 깔린 창(ㄱ자) + 앞에 있는 창(사각형)
                maxBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 8H4v12h12v-4" />
                        <path d="M20 4H8v12h12V4z" />
                    </svg>`;
            } else {
                // 최대화 아이콘: 단순한 정사각형
                maxBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="4" y="4" width="16" height="16"></rect>
                    </svg>`;
            }
        };

        // 이벤트 등록 (사용자가 창 경계를 드래그해서 최대화할 때도 대응)
        this.remoteWindow.on('maximize', updateMaxBtnIcon);
        this.remoteWindow.on('unmaximize', updateMaxBtnIcon);

        // 초기 로드 시 한 번 실행
        updateMaxBtnIcon();


    }


    // 🔔 신규 기능 에 대한 상세 영역 이동 버튼 
    //#region 🔔신규기능 존재시 버튼 이벤트
    onFeatureButtonClick(targetPath, version) {

        //로딩바 시작 - 메시지: 도움말 문서를 준비하는 중입니다.
        this.toggleGlobalLoader(true, i18n.getMessage(this.language, '563'));

        this.ipcRenderer.once('openNewFeature:cb', (event, data) => {
            
            //로딩바 해제
            this.toggleGlobalLoader(false);

            //오류 발생?
            if(data.RETCD === "E"){
                //처리 오류(562)
                return this.showAlert('error', i18n.getMessage(this.language, '562'), data.RTMSG);   
            }
	        
	    });

        // console.log(`[Callback Debug] Path: ${targetPath}, Version: ${version}`);
        //신규 기능 상세 보기 요청
        this.ipcRenderer.send('openNewFeature', { 
            path: targetPath, 
            version: version 
        });
      
    }
    //#endregion


    // 🚀 
    applyFilter() {
        const q = this.state.search.toLowerCase();
        this.state.filtered = this.state.allData.filter(d => {
            const yMatch = !this.state.year || d.date.getFullYear() === this.state.year;
            const sMatch = !q || 
                d.version.toLowerCase().includes(q) || 
                d.patch.includes(q) || 
                d.changes.some(c => c.toLowerCase().includes(q)) || 
                (d.features && d.features.some(f => f.content.toLowerCase().includes(q)));
            return yMatch && sMatch;
        });

        this.state.renderedCount = 0;
        this.renderEngine.reset();
        this.renderEngine.renderNext();
        document.getElementById('totalBadge').innerText = `${this.state.filtered.length} releases`;
        document.getElementById('emptyMsg').style.display = this.state.filtered.length ? 'none' : 'block';
    }


    /**
     * 빈 결과/오류 메시지 영역 텍스트를 갱신한다.
     * @param {string} message 화면에 표시할 메시지
     */
    updateEmptyMessage(message) {
        const oMsg = document.body.querySelector('.empty-text');

        if (!oMsg) {
            return;
        }

        const oTitle = oMsg.querySelector('h3');

        if (oTitle) {
            oTitle.textContent = message || '';
        }
    }


    /**
     * @description 전역 서비스 로딩 레이어의 표시 상태를 제어합니다.
     * @param {boolean} show - 노출 여부 (true: 표시, false: 숨김)
     * @param {string} [message] - 화면에 출력할 메시지 (줄바꿈 '\n' 지원)
     * @details 
     * - 하드웨어 가속 및 브라우저 렌더링 파이프라인(rAF)을 활용하여 성능 저하 없이 부드러운 Fade 효과를 제공합니다.
     * - 전달된 메시지의 개행 문자를 HTML 브레이크 태그(<br>)로 자동 치환합니다.
     */
    toggleGlobalLoader(show, message) {
        const loader = document.getElementById('globalLoader');
        const msgEl = loader?.querySelector('.loader-message');

        if (!loader) return;

        if (show) {
            if (msgEl) {
                // 🚀 줄바꿈 방어 로직
                // 1. message가 없으면 기본 문구 출력
                // 2. \n 문자를 <br> 태그로 치환하여 HTML로 삽입
                const safeMessage = message ? message.replace(/\n/g, '<br>') : "Loading...";
                msgEl.innerHTML = safeMessage; 
            }

            loader.style.display = 'flex';
            
            // 브라우저 렌더링 파이프라인 최적화
            requestAnimationFrame(() => {
                setTimeout(() => {
                    loader.style.opacity = '1';
                }, 10);
            });
        } else {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 200); 
        }
    }


    /**
     * 전역 팝업 메시지 제어
     * @param {string} type - 'info', 'error'
     * @param {string} title - 제목
     * @param {string} message - 내용 (\n 지원)
     */
    showAlert(type, title, message) {

        const modal = document.getElementById('globalModal');
        const content = modal.querySelector('.modal-content');
        const iconWrap = document.getElementById('modalIcon');
        const titleEl = document.getElementById('modalTitle');
        const msgEl = document.getElementById('modalMessage');
        const btn = document.getElementById('modalConfirmBtn');

        if (!modal) return;

        // 1. 타입 설정 (CSS 클래스 교체)
        content.className = `modal-content ${type}`;

        // 2. 아이콘 설정
        iconWrap.innerHTML = type === 'error' 
            ? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
            : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

        // 3. 텍스트 설정 (줄바꿈 처리)
        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');

        // 4. 표시 애니메이션
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // 5. 닫기 이벤트 (한 번만 실행되도록 처리)
        btn.onclick = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 200);
        };

    }

}
//#endregion ReleaseApp


/** ───────────────────────────────────────
 * 🧠 Class: DataManager
 //#region DataManager
 * ----------------------------------------
 * 🔹 릴리즈 노트 서비스 호출 및 데이터 조회를 담당한다.
 * 🔹 서버 응답값을 버전, 패치, 변경이력, 신규 기능 목록 형태로 정리한다.
 * 🔹 조회 중 오류가 발생하면 다국어 메시지와 오류코드를 화면에 출력한다.
*/
class DataManager {
    async fetchData() {

        // 브라우저가 유휴 상태(idle)가 될 때까지 대기
        await new Promise(rv => requestIdleCallback(rv));

        const _service = releaseApp.if_data?.service || undefined;
        const _isdev   = releaseApp?.if_data?.isdev  || false;
        const _langu   = releaseApp?.language  || 'EN';

        //테스트 디버깅 용 - debugger 처리를 위해 잠시 팬딩처리
        // if(_isdev){ await new Promise(r => setTimeout(r, 1500)); }
        // debugger;

        let _reqUrl = `${_service.host}/zu4a_wbc/u4a_ipcmain/GET_WS_RELEASE_DATA`;

        if(_isdev){
            _reqUrl = `${_service.host}/zu4a_rnd/GET_WS_RELEASE_DATA`;
        }

        //파라메터 설정 
        if (_service?.params && typeof _service.params === "object") {
            _service.params['sap-language'] = _langu;
            const _queryString = new URLSearchParams(_service.params).toString();

            if (_queryString) {
                _reqUrl += `?${_queryString}`;
            }
        }

        // 1. 타임아웃 설정 (10초 후 강제 종료)
        const _controller = new AbortController();
        const _timeoutId = setTimeout(() => _controller.abort(), 60000);

        const _defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: _controller.signal,
          
        };

        try {
            const _response = await fetch(_reqUrl, _defaultOptions);
            clearTimeout(_timeoutId);

            // 2. HTTP 에러 체크 (404, 500 등)
            if (!_response.ok) {
                throw new Error(`HTTP error! status: ${_response.status}`);
            }

            // 3. 데이터 파싱
            const _data = await _response.json();

            // 출력값 수집
            const _renderNotes = [];

            _data.forEach((note, index) => {
                
                var _features = [];

                //신규 기능 목록 
                note.FEATURES.forEach((feat, index) => {

                    _features.push({
                        content    :feat.SUMMARY,  //기능 요약 설명
                        targetPath :feat.DOC_PATH, //상세 도움말 문서 경로
                    });
                    
                });

                // 출력값 구성 
                _renderNotes.push({
                    version   : note.VERSN, //메이저 버젼 
                    patch     : note.SPLEV, //서포트 패치 번호 
                    date      : note.ERDAT, //업그레이드 일자

                    //변경 이력
                    changes   : note.CHANGES.map(item => item.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()),

                    //신규 기능 목록
                    features  : _features,
                });

            });
            
            return _renderNotes;

            
        } catch (error) {

            let _errorCode = 'REL-000';
            let _errorMessage = '';

            if (error.name === 'AbortError') {
                _errorCode = 'REL-001';
                console.error(`[${_errorCode}] 요청 시간이 초과되었습니다.`, error);
            } else {
                _errorCode = 'REL-002';
                console.error(`[${_errorCode}] 데이터 로드 중 에러 발생`, error);
            }

            // _errorMessage = `오류코드: ${_errorCode}\n요청을 처리하는 중 문제가 발생했습니다.\n잠시 후 다시 시도해 주세요.\n동일한 문제가 계속 발생하면 담당자에게 문의해 주세요.`;
            _errorMessage = `${i18n.getMessage(_langu, '550')}: ${_errorCode}\n${i18n.getMessage(_langu, '553')}\n${i18n.getMessage(_langu, '552')}\n${i18n.getMessage(_langu, '551')}`;

            //메시지 출력 
            releaseApp.updateEmptyMessage(_errorMessage);

            return [];
            
        }

    }

    process(data) {
        return data.map((d, idx) => ({
            ...d,
            id: `rel-${idx}`,
            isLatest: idx === 0,
            date: new Date(d.date.substring(0,4), d.date.substring(4,6)-1, d.date.substring(6,8)),
            type: parseInt(d.patch) === 0 ? 'MAJOR' : 'PATCH'
        }));
    }
}
//#endregion DataManager


/** ───────────────────────────────────────
 * 🧠 Class: ThemeManager
 //#region ThemeManager
 * ----------------------------------------
 * 🔹 화면 테마(light/dark) 적용 및 전환을 관리한다.
*/
class ThemeManager {
    constructor(initialTheme) {
        this.root = document.documentElement;
        this.btn = document.getElementById('themeToggleBtn');
        this.setTheme(initialTheme);
        if (this.btn) this.btn.onclick = () => this.toggle();
    }

    setTheme(theme) {
        this.root.setAttribute('data-theme', theme);
        localStorage.setItem('u4a-workspace-theme', theme);
    }

    toggle() {
        const next = this.root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    }
}
//#endregion ThemeManager


/** ───────────────────────────────────────
 * 🧠 Class: RenderEngine
 //#region RenderEngine
 * ----------------------------------------
 * 🔹 릴리즈 노트 목록의 화면 렌더링과 가상 스크롤 처리를 담당한다.
 * 🔹 카드 표시, 연도 필터, 가시성 애니메이션, 프루닝(pruning) 동작을 관리한다.
 * 🔹 스크롤 위치에 따라 다음 목록을 추가 렌더링하고 화면 성능을 최적화한다.
*/
class RenderEngine {
    constructor(app) {
        this.app = app;
        this.tl = document.getElementById('timeline');
        this.vp = document.getElementById('viewport');
        this.pageSize = 30;
        this.lastY = null;
        this.initObservers();
    }

    initObservers() {
        // 가시성 애니메이션
        this.visObs = new IntersectionObserver(es => es.forEach(e => {
            if(e.isIntersecting) e.target.classList.add('visible');
        }), { root: this.vp, threshold: 0.01 }); // threshold를 낮춰서 조금만 보여도 인식하게 변경

        this.pruneObs = new IntersectionObserver(es => {
            if (this.app.state.search) return;
            es.forEach(e => {
                const el = e.target;
                if (!e.isIntersecting) {
                    // 🚀 핵심 수정: 카드가 화면에서 완전히 사라졌을 때만 Pruning 수행
                    if (!el.dataset.pruned && el.offsetHeight > 0) {
                        // 현재의 실제 높이를 고정값으로 저장 (텍스트가 많으므로 정확한 수치 필요)
                        el.style.height = `${el.getBoundingClientRect().height}px`;
                        el.innerHTML = '';
                        el.dataset.pruned = '1';
                    }
                } else {
                    if (el.dataset.pruned) {
                        const item = this.app.state.filtered.find(d => d.id === el.dataset.id);
                        if (item) {
                            el.innerHTML = this.getCardInner(item);
                            // 🚀 텍스트가 많으므로 auto로 푼 뒤 브라우저가 높이를 재계산할 시간을 줌
                            el.style.height = 'auto';
                            delete el.dataset.pruned;
                        }
                    }
                }
            });
        }, { 
            root: this.vp, 
            // 🚀 rootMargin을 상하로 더 크게 벌려서(2000px) 긴 내용이 미리 로드되게 함
            rootMargin: '2000px 0px' 
        });

        // 리사이즈 옵저버는 그대로 유지 (창 크기 변할 때 대응)
        this.resizeObs = new ResizeObserver(entries => {
            for (let entry of entries) {
                const el = entry.target;
                if (!el.dataset.pruned) {
                    el.style.height = 'auto';
                }
            }
        });

        // 무한 스크롤
        this.sentinel = document.createElement('div');
        this.sentObs = new IntersectionObserver(es => {
            if (es[0].isIntersecting && this.app.state.renderedCount < this.app.state.filtered.length) {
                this.renderNext();
            }
        }, { root: this.vp, rootMargin: '800px' });

    }

    reset() { this.tl.innerHTML = ''; this.lastY = null; this.sentObs.disconnect(); }

    renderFilters() {
        const bar = document.getElementById('yearBar');
        const years = [...new Set(this.app.state.allData.map(d => d.date.getFullYear()))].sort((a,b)=>b-a);
        const create = (l, v, act=false) => {
            const btn = document.createElement('button');
            btn.className = `year-btn ${act?'active':''}`;
            btn.innerText = l;
            btn.onclick = () => {
                bar.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active'); 
                this.app.state.year = v; 
                this.vp.scrollTo({ top: 0 });
                this.app.applyFilter();
            };
            bar.appendChild(btn);
        };
        create('ALL', null, true);
        years.forEach(y => create(y, y));
    }

    renderNext() {
        const slice = this.app.state.filtered.slice(this.app.state.renderedCount, this.app.state.renderedCount + this.pageSize);
        const frag = document.createDocumentFragment();

        slice.forEach(item => {
            const y = item.date.getFullYear();
            if (y !== this.lastY) {
                this.lastY = y;
                const h = document.createElement('div');
                h.style = "margin: 30px 0 15px -40px; position:sticky; top:0; background:var(--bg); z-index:10; padding:5px 0;";
                h.innerHTML = `<span style="padding:4px 12px; border-radius:8px; background:var(--nm-dark); color:var(--accent2); font-weight:800; font-family:'JetBrains Mono'; box-shadow:2px 2px 5px var(--nm-dark);">${y}년</span>`;
                frag.appendChild(h);
            }
            const card = document.createElement('div');
            card.className = `release-card ${item.isLatest ? 'latest-version' : ''}`;
            card.dataset.id = item.id;
            card.innerHTML = this.getCardInner(item);
            
            frag.appendChild(card);
            this.visObs.observe(card);
            this.pruneObs.observe(card);

            // 🚀 [추가] 이 카드의 리사이즈(너비 변화)를 감시하기 시작
            this.resizeObs.observe(card);

        });

        this.tl.appendChild(frag);
        this.tl.appendChild(this.sentinel);
        this.sentObs.observe(this.sentinel);
        this.app.state.renderedCount += slice.length;
    }

    getCardInner(d) {
        const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}-${String(d.date.getDate()).padStart(2,'0')}`;
        const features = d.features.map(f => `
            <div class="feature-box">
                <div style="display:flex; align-items:flex-start;">
                    <span class="feature-badge">NEW</span>
                    <span class="feature-content">${f.content}</span>
                </div>
                <button class="feature-btn" data-path="${f.targetPath}" data-version="${d.version}-${d.patch}">
                    이동 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
            </div>
        `).join('');

        return `
            ${d.isLatest ? '<span style="position:absolute; top:-10px; right:20px; background:var(--accent); color:#fff; font-size:10px; font-weight:900; padding:3px 12px; border-radius:20px; box-shadow:0 0 10px var(--accent); z-index:5;">LATEST</span>' : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <b style="color:var(--accent); font-size:18px; font-family:'JetBrains Mono';">${d.version} - ${d.patch}</b>
                    <span style="font-size:11px; font-weight:800; padding:2px 10px; background:var(--nm-dark); border-radius:20px; color:var(--accent2); border:1px solid var(--border);">${d.type}</span>
                </div>
                <span style="font-size:12px; color:var(--muted); font-family:'JetBrains Mono'; font-weight:600;">${dateStr}</span>
            </div>
            <div class="change-list">
                ${d.changes.map(c => `
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <span style="width:6px; height:6px; background:var(--accent); border-radius:50%; margin-top:8px; flex-shrink:0;"></span>
                        <div class="change-text">${c}</div>
                    </div>
                `).join('')}
            </div>
            ${features}
        `;
    }
}
//#endregion RenderEngine


/** ───────────────────────────────────────
 * 🧠 Class: TranslationManager
 //#region TranslationManager
 * ----------------------------------------
 * 🔹 다국어 메시지 조회 및 화면 번역 적용을 관리한다.
 * 🔹 data-msg-* 속성을 기준으로 텍스트와 DOM 속성값을 언어별로 갱신한다.
 * 🔹 화면 요소의 번역 메시지를 일괄 반영하는 역할을 담당한다.
*/
class TranslationManager {
    constructor() {

        // 감시할 속성 리스트 (필요한 것만 정의하거나 전체 탐색 가능)
        this.targetAttributes = ['title', 'placeholder', 'aria-label', 'value'];

    }

    /**
     * 기존에 사용 중인 getmessage('ID')의 내부 구현체
     */
    getMessage(langCode, msgId) {
        return WSUTIL.getWsMsgClsTxt(langCode, "ZMSG_WS_COMMON_001", msgId); 
    }

    /**
     * 언어 변경 실행 함수
     */
    applyTranslation(langCode) {

        // 화면상에 data-msg-id 속성을 가진 요소들을 실시간 번역

        // 1. 일반 텍스트 노드 처리 (기본: data-msg-id)
        document.querySelectorAll('[data-msg-id]').forEach(el => {
            const id = el.getAttribute('data-msg-id');
            this.updateTextNode(el, this.getMessage(langCode, id));
        });


        // 2. 속성(Attribute) 자동 처리
        // 'title', 'placeholder' 등을 루프 돌며 처리
        this.targetAttributes.forEach(attr => {
            const dataAttr = `data-msg-${attr}`; // 예: data-msg-title
            document.querySelectorAll(`[${dataAttr}]`).forEach(el => {
                const id = el.getAttribute(dataAttr);
                const translated = this.getMessage(langCode, id);
                
                // 실제 DOM 속성 업데이트 (예: el.title = "...")
                el.setAttribute(attr, translated);
            });
        });

        console.log(`언어가 [${langCode}]로 변경되었습니다.`);
    }

    /**
     * DOM 텍스트 노드 업데이트 (최적화 버전)
     */
    updateTextNode(element, newText) {
        const firstChild = element.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
            firstChild.nodeValue = newText;
        } else {
            element.prepend(document.createTextNode(newText));
        }
    }
}
//#endregion TranslationManager


/*************************************************************
 * @function - SYSID에 해당하는 테마 변경 IPC 이벤트
 *************************************************************/
function _onIpcMain_if_p13n_themeChange(oSender, oParams){

    let sTheme = oParams?.THEME || "";

    let sThemeName = "light";
    if(sTheme.endsWith("dark") === true){
        sThemeName = "dark";
    }

    window.releaseApp.themeManager.setTheme(sThemeName);

} // end of _onIpcMain_if_p13n_themeChange

/*************************************************************
 * @function - IPC Event 등록
 *************************************************************/
function _attachIpcEvents(){

    let sSysID = window?.releaseApp?.if_data?.sysid || "";
    if(!sSysID){
        return;
    }    

    ipcMain.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);

} // end of _attachIpcEvents

/*************************************************************
 * @function - IPC Event 해제
 *************************************************************/
function _detachIpcEvents(){

    let sSysID = window?.releaseApp?.if_data?.sysid || "";
    if(!sSysID){
        return;
    }    

    ipcMain.off(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);

} // end of _detachIpcEvents

//#region window.onload
window.onload = ()=>{

    //번역 인스턴스 초기화 
    window.i18n = new TranslationManager();

    //화면 제어 인스턴스 초기화
    window.releaseApp = new ReleaseApp();

    // IPC Event 등록
    _attachIpcEvents();

};
// window.onload = () => new ReleaseApp();

window.addEventListener("pagehide", function(){

    // IPC Event 해제
    _detachIpcEvents();

}, { once: true });