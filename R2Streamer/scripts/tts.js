var is_tts_ready_ing = false;
var is_tts_auto_page = false;       // 자동 페이지 넘김 처리하면서 TTS 진행
var tts_result_json = null;

function tts_ready(is_auto_page) {
    is_tts_auto_page = is_auto_page;
    
    if (tts_result_json != null) {
        log('is_tts_ready is true');
        call_to_native_tts_ready();
        return;
    }
    if (is_tts_ready_ing) {
        log('is_tts_ready_ing is true');
        return;
    }
    
    is_tts_ready_ing = true;
    
    var result_json = ADDON_IPAPRIKA.JS.get_TTS_Json_List(); // TTS 대상 Json 문자열 가져오기
    tts_result_json = JSON.parse(result_json); // Json 객체로 변환 ('get_TTS_Json_List' 함수 내부로직에서 변환해주고 싶었지만 무슨 이유에서인지 에러가 발생함.. 그냥 알아서 변환해주도록..)
    is_tts_ready_ing = false;
    call_to_native_tts_ready();
}

function tts_execute(current_index) {
    if (tts_result_json == null) {
        log('tts_result_json is null');
        return;
    }
    
    if (current_index >= tts_result_json.length) {
        // 모두 읽은 경우
        ADDON_IPAPRIKA.JS.remove_TTS_All_Highlight(); // 하이라이트 처리된 영역 초기화
        
        // 완료처리
        call_to_native_tts_finished();
        
        if (is_tts_auto_page) {
            var is_last_page = ADDON_IPAPRIKA.JS.move_TTS_Next_Page(); // 다음 페이지로 이동
            
            if (is_last_page) {
                call_to_native_tts_last_page();
            } else {
                setTimeout(function() {
                           tts_reset();
                           tts_ready(is_tts_auto_page);
                }, 1000);
            }
        }
        
        return;
    }
    
    // 현재 텍스트 TTS 읽기중인 영역 하이라이트 설정
    ADDON_IPAPRIKA.JS.set_TTS_Item_Highlight(tts_result_json[current_index].ID);
    
    // TTS 읽는 로직 작성 필요
    call_to_native_current_idx(tts_result_json[current_index].TEXT, current_index);
}

function tts_reset() {
    tts_result_json = null;
    is_tts_ready_ing = false;
    ADDON_IPAPRIKA.JS.remove_TTS_All_Highlight(); // 하이라이트 처리된 영역 초기화
}

function log(string) {
    try {
        webkit.messageHandlers.ttsLog.postMessage(string);
    } catch (error) {}
}

// 네이티브에서 읽기 완료시 호출
function call_from_native_tts_page(index) {
    tts_execute(index);
}

function call_from_native_next_page() {
    ADDON_IPAPRIKA.JS.move_TTS_Next_Page(); // 다음 페이지로 이동
}

function call_from_native_reset() {
    tts_reset();
}

function call_to_native_tts_ready() {
    try {
        webkit.messageHandlers.ttsHandler.postMessage({event: "ready", auto: is_tts_auto_page});
    } catch (error) {
        log(error);
    }
}

function call_to_native_current_idx(txt, idx) {
    try {
        webkit.messageHandlers.ttsHandler.postMessage({event: "current", index: idx, auto: is_tts_auto_page, text: txt});
    } catch (error) {
        log(error);
    }
}

function call_to_native_tts_finished() {
    try {
        webkit.messageHandlers.ttsHandler.postMessage({event: "finish", auto: is_tts_auto_page});
    } catch (error) {
        log(error);
    }
}

function call_to_native_tts_last_page() {
    try {
        webkit.messageHandlers.ttsHandler.postMessage({event: "last", auto: is_tts_auto_page});
    } catch (error) {
        log(error);
    }
}
