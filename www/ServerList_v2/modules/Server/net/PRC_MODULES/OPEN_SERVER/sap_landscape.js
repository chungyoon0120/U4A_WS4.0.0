
/****************************************************************************
 * 🔥 Global Variables
 ****************************************************************************/
    const oModule = {};


/****************************************************************************
 * 🔥 Remote / Modules
 ****************************************************************************/

    const PATH = require("path");
    const FS = require('fs');
    const XMLJS = require('xml-js');


/****************************************************************************
 * 🔥 Global Prefix
 ****************************************************************************/   


/****************************************************************************
 * 🔥 Global Path
 ****************************************************************************/    


/****************************************************************************
 * 🔥 Private functions
 ****************************************************************************/

    /**
     * 서비스 UUID로 부모 노드 UUID를 찾는 함수
     * @param {string} serviceUuid - 찾을 서비스 UUID
     * @returns {string} - 직계 부모 노드의 UUID 또는 undefined
     */
    function _findDirectParentNode(xmlFilePath, serviceUuid) {

        try {
        
            // XML 파일 읽기
            const xml = FS.readFileSync(xmlFilePath, 'utf8');
        
            // XML을 JavaScript 객체로 변환
            const result = XMLJS.xml2js(xml, { compact: true });
        
            // 직계 부모 노드의 UUID를 저장할 변수
            let directParentUuid = undefined;
            
            // 안전하게 객체 접근하는 헬퍼 함수
            const safeGet = (obj, path) => {
                try {
                    const parts = path.split('.');
                    let current = obj;
                    for (const part of parts) {
                        if (current === undefined || current === null) return undefined;
                        current = current[part];
                    }
                    return current;
                } catch (error) {
                    if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
                    return undefined;
                }
            };
        
            /**
             * 재귀적으로 노드를 검색하고 직계 부모를 찾는 함수
             * @param {Object} node - 검색할 노드 객체
             * @param {string} nodeUuid - 현재 노드의 UUID
             * @returns {boolean} - 찾았는지 여부
             */
            function searchInNode(node, nodeUuid) {

                // 이 노드에 Item이 있는지 검사
                if (node.Item) {
                    const items = Array.isArray(node.Item) ? node.Item : [node.Item];
                    
                    for (const item of items) {
                        const currentServiceId = safeGet(item, '_attributes.serviceid');
                        
                        if (currentServiceId === serviceUuid) {
                            directParentUuid = nodeUuid;
                            return true;
                        }
                    }
                }
                
                // 이 노드에 하위 노드가 있는지 검사
                if (node.Node) {
                    const childNodes = Array.isArray(node.Node) ? node.Node : [node.Node];
                    
                    for (const childNode of childNodes) {
                        const childNodeUuid = safeGet(childNode, '_attributes.uuid') || undefined;
                        if (searchInNode(childNode, childNodeUuid)) {
                            return true;
                        }
                    }
                }
                
                return false;
            }
        
            // 모든 워크스페이스를 검색
            const workspaces = safeGet(result, 'Landscape.Workspaces.Workspace');
            if (!workspaces) {
                return undefined;
            }
        
            const workspacesArray = Array.isArray(workspaces) ? workspaces : [workspaces];
        
            for (const workspace of workspacesArray) {
                const workspaceUuid = safeGet(workspace, '_attributes.uuid') || undefined;
                
                // 워크스페이스 직계 Item 검사
                if (workspace.Item) {
                    const items = Array.isArray(workspace.Item) ? workspace.Item : [workspace.Item];
                    
                    for (const item of items) {
                        const currentServiceId = safeGet(item, '_attributes.serviceid');
                        
                        if (currentServiceId === serviceUuid) {
                            directParentUuid = workspaceUuid;
                            return directParentUuid;
                        }
                    }
                }
                
                // 하위 노드 검사
                if (workspace.Node) {
                    const nodes = Array.isArray(workspace.Node) ? workspace.Node : [workspace.Node];
                    
                    for (const node of nodes) {
                        const nodeUuid = safeGet(node, '_attributes.uuid') || undefined;
                        if (searchInNode(node, nodeUuid)) {
                            return directParentUuid;
                        }
                    }
                }
            }
        
            return directParentUuid;
    
        } catch (error) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
            
            return undefined;

        }

    } // end of _findDirectParentNode


/****************************************************************************
 * 🔥 Public functions
 ****************************************************************************/


    /*********************************************************************
     * @function
     * - Landscape xml을 Json Parse 해서 UUID가 속한 폴더 정보를 구한다.
     *   
     * 
     * @param {string} sLandscapeXmlPath 
     * - SAPLandscape.xml 파일 경로
     * 
     * @param {string} sUUID
     * - 서버의 UUID 정보
     * 
     * @returns {Promise<Object|undefined>} 
     * - 폴더 정보 JSON 객체 또는 `undefined`
     *********************************************************************/
    oModule.getSAPLogonRootDirInfo = function(sLandscapeXmlPath, sUUID){

        return new Promise(async function(resolve){

            if(!sLandscapeXmlPath || !sUUID){
                return resolve();
            }
            
            try {

                // 파일이 존재하지 않는 경우 undefined 반환
                if (!FS.existsSync(sLandscapeXmlPath)) {                
                    return resolve();
                }                
      
                // 서비스 UUID에 해당하는 노드 찾기      
                const parentUuid = _findDirectParentNode(sLandscapeXmlPath, sUUID);
                if(!parentUuid){
                    return resolve();
                }

                return resolve({
                    parent_uuid: parentUuid
                });
    
            } catch (error) {
                if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
    
                // 예상치 못한 오류 발생시 undefined 출력
                return resolve();
    
            }

        });

    }; // end of oModule.getParentNodeInfo


module.exports = oModule;