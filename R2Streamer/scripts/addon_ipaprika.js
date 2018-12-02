var ADDON_IPAPRIKA = (ADDON_IPAPRIKA == null) ? {} : ADDON_IPAPRIKA;

ADDON_IPAPRIKA.JS = {

    /*****************************************************************
    * TTS 대상 객체 Json 목록 가져오기
    *****************************************************************/
    get_TTS_Json_List: function () {
        
        // TTS 대상 객체 Json 문자열은 아래와 같은 형태로 반환된다.
        //--------------------------------------------------------------------------------
        //[
        //    { "ID": "-tts-item-idx-1", "TEXT": "Now the rumbling of the great organ swelled to a roar, pressing, like a rising giant, against the vaulted ceiling, to burst through it." }
        //    , { "ID": "-tts-item-idx-2", "TEXT": "Freder bent his head backwards, his wide-open, burning eyes stared unseeingly upward. His hands formed music from the chaos of the notes; struggling with the vibration of the sound and stirring him to his innermost depths." }
        //    , { "ID": "-tts-item-idx-3", "TEXT": "He was never so near tears in his life and, blissfully helpless, he yielded himself up to the glowing moisture which dazzled him." }
        //]
        //--------------------------------------------------------------------------------
        var result_json = ""; // TTS 대상 객체 Json 문자열이 저장되는 변수

        // 다른 형상은 보지못해서 모르겠지만..
        // 샘플로 넘어온 html 에는 내용이 아래와 같은 태그 구조로 되어있었음..
        //--------------------------------------------------------------------------------
        //<div class="body">
        //    <div id="chapter_32339" class="chapter">
        //--------------------------------------------------------------------------------
        // 혹시라도 다른 html 태그 내에 내용이 존재하는 경우 다르게 지정해야함!
        var content_root = $(".body .chapter");
        
        // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 제거 (해당 속성이 없을 경우 TTS 대상에서 제외됨)
        content_root.find(".ipaprika_character_area").each(function () {

            // TTS 커스텀 태그 영역 인덱스 번호 속성 제거
            var new_class = $(this).attr("class").replace(/-tts-item-idx-.*?-/g, "");
            $(this).attr("class", new_class);

            $(this).css("color", $(this).attr("ipaprika_def_color")); // TTS 커스텀 태그 영역 하이라이트 해제
        });

        // TTS 커스텀 태그 영역 설정 함수
        var set_TTS_Tag_Area = function (obj) {

            if (obj.html().indexOf("ipaprika_character_area") > -1) return;
            if (!obj.is(":visible")) return;

            var is_tag = false;
            var result_content_inner = "";

            var arr_content_html_inner = obj.html().trim().split("");
            arr_content_html_inner.forEach(function (c_inner) {

                if (c_inner == "<") {
                    // 태그의 시작일 경우

                    result_content_inner += c_inner;
                    is_tag = true;
                }
                else if (c_inner == ">") {
                    // 태그의 끝일 경우

                    result_content_inner += c_inner;
                    is_tag = false;
                }
                else {

                    if (!is_tag) {
                        // 일반 문자 일 경우

                        result_content_inner += "<span class='ipaprika_character_area' style='padding:0px; margin:0px;'>" + c_inner + "</span>";
                    }
                    else {
                        // 태그 문자 일 경우

                        result_content_inner += c_inner;
                    }
                }
            });

            // 문장의 종료를 알리는 라인피드 값을 구분 하기 위한 태그 추가 (예로 소제목과 본문을 구분짓기 위함)
            result_content_inner += "<span class='ipaprika_character_area -tts-item-end-' style='padding:0px; margin:0px;'></span>";

            String.prototype.replaceAll = function (org, dest) {
                return this.split(org).join(dest);
            }

            // 이거 치환해주지 않으면 '&nbsp;', '&lt;', '&gt;' 라는 문자 하나 하나에도 span 태그로 묶여서 텍스트 그대로 표시됨..
            result_content_inner = result_content_inner.replaceAll("<span class='ipaprika_character_area' style='padding:0px; margin:0px;'>&</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>n</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>b</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>s</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>p</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>;</span>", "&nbsp;");
            result_content_inner = result_content_inner.replaceAll("<span class='ipaprika_character_area' style='padding:0px; margin:0px;'>&</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>l</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>t</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>;</span>", "&lt;");
            result_content_inner = result_content_inner.replaceAll("<span class='ipaprika_character_area' style='padding:0px; margin:0px;'>&</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>g</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>t</span><span class='ipaprika_character_area' style='padding:0px; margin:0px;'>;</span>", "&gt;");

            obj.html(result_content_inner);
        }

        // TTS 커스텀 태그 영역 설정
        content_root.children().each(function () {

            var obj = $(this);
                
            if (obj.children().length > 0) {
                // 하위에 태그가 존재할 경우

                obj.children().each(function () {

                    set_TTS_Tag_Area($(this)); // TTS 커스텀 태그 영역 설정
                });
            }
            else {
                // 하위에 태그가 존재하지 않은 경우

                set_TTS_Tag_Area(obj); // TTS 커스텀 태그 영역 설정
            }
        });

        var scroll_left = $("body").scrollLeft(); // 현재 스크롤 영역의 left 위치 값
        var scroll_top = $("body").scrollTop(); // 현재 스크롤 영역의 top 위치 값
        var scroll_right = scroll_left + $(window).width(); // 현재 스크롤 영역의 right 위치 값
        var scroll_bottom = scroll_top + $(window).height(); // 현재 스크롤 영역의 bottom 위치 값

        var tts_item_text = "";
        var tts_item_idx = 0;

        // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 설정 함수
        var set_TTS_Tag_Index = function (obj) {

            var ipaprika_character_area = obj;

            var character_left = $(ipaprika_character_area).offset().left; // 현재 문자의 left 위치 값
            var character_top = $(ipaprika_character_area).offset().top; // 현재 문자의 top 위치 값

            // 왼쪽 영역을 벗어난 문자일 경우
            if (character_left < scroll_left) {
                return true;
            }

            // 위쪽 영역을 벗어난 문자일 경우
            if (character_top < scroll_top) {
                return true;
            }

            // 오른쪽 영역을 벗어난 문자일 경우
            if (character_left > scroll_right) {
                return true;
            }

            // 아래쪽 영역을 벗어난 문자일 경우
            if (character_top > scroll_bottom) {
                return true;
            }

            // tts 순서 번호 데이터 추가
            var new_class = $(ipaprika_character_area).attr("class").replace(/-tts-item-idx-.*?-/g, "");
            new_class += " -tts-item-idx-" + tts_item_idx + "-";
            $(ipaprika_character_area).attr("class", new_class);

            var c = $(ipaprika_character_area).text();

            var is_sentence_end = false;

            var matches = c.match(/\n/g);
            var new_lines = matches ? matches.length : 0;

            if (new_lines == 1) {

                // 줄바꿈 일 경우

                is_sentence_end = true;
            }

            if ($(ipaprika_character_area).attr("class").match(/-tts-item-end-/g)) {

                // 문장의 종료를 알리는 라인피드 영역일 경우

                is_sentence_end = true;
            }

            if (
				c == "."
				|| c == "!"
				|| c == "?"
			) {

                // 문장의 끝을 알리는 문자에 도달한 경우

                if (
					tts_item_text.length > 2
				) {

                    // 문장의 끝을 알리는 문자 바로 뒤에 위치한 문자 검사 ('www.tset.com' 또는 '2.5센티' 등.. 실제 문장의 끝이 아닌 경우를 위함)

                    var c_end = tts_item_text.substring(tts_item_text.length - 2);

                    if (
						c_end.match(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/gi)
					) {

                        is_sentence_end = true;
                    }
                }
            }

            tts_item_text += c;

            if (is_sentence_end) {

                tts_item_text = "";

                // 설정된 하이라이트 영역에 읽을 내용이 없을 경우 대상에서 제외
                var tts_item_temp = content_root.find(".-tts-item-idx-" + tts_item_idx + "-");
                if (tts_item_temp.text().trim() == "") {

                    var new_class = $(ipaprika_character_area).attr("class").replace(/-tts-item-idx-.*?-/g, "");
                    $(ipaprika_character_area).attr("class", new_class);		
                }
                else {

                    tts_item_idx++;
                }
            }
        }

        // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 설정 (해당 속성이 있을 경우 TTS 대상에 포함됨)
        content_root.find(".ipaprika_character_area").each(function () {

            set_TTS_Tag_Index($(this)); // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 설정
        });
        
        // TTS 대상 객체 반환 Json 문자열 생성
        result_json += "[";
        for (var idx = 0; idx < tts_item_idx; idx++) {

            var ID = ".-tts-item-idx-" + idx + "-";
            var TEXT = "";
            content_root.find(ID).each(function () {

                TEXT += $(this).text();
            });
            if (idx > 0) result_json += ",";
            result_json += "{\"ID\": \"" + ID + "\", \"TEXT\": \"" + ADDON_IPAPRIKA.JS.convert_Json_Val(TEXT) + "\"}";
        }
        result_json += "]";

        //result_json = JSON.parse(result_json); // Json 객체로 변환후 리턴하는게 최적이지만.. 여기서는 에러가 발생해서 실행되지 않는다.. 원인은 모르겠음.. -_-;

        return result_json;
    },

    /*****************************************************************
    * TTS 읽기중인 영역 하이라이트 처리
    *****************************************************************/
    set_TTS_Item_Highlight: function (id) {
        
        // 다른 형상은 보지못해서 모르겠지만..
        // 샘플로 넘어온 html 에는 내용이 아래와 같은 태그 구조로 되어있었음..
        //--------------------------------------------------------------------------------
        //<div class="body">
        //    <div id="chapter_32339" class="chapter">
        //--------------------------------------------------------------------------------
        // 혹시라도 다른 html 태그 내에 내용이 존재하는 경우 다르게 지정해야함!
        var content_root = $(".body .chapter");
        
        // 모든 element 영역 하이라이트 해제
        content_root.find(".ipaprika_character_area").each(function () {

            $(this).css("color", $(this).attr("ipaprika_def_color"));
        });

        // 현재 element 영역 하이라이트 설정
        content_root.find(id).each(function () {
            $(this).attr("ipaprika_def_color", $(this).css("color"));
            $(this).css("color", "orange");
        });
    },

    /*****************************************************************
    * TTS 하이라이트 처리 영역 초기화
    *****************************************************************/
    remove_TTS_All_Highlight: function () {
        
        // 다른 형상은 보지못해서 모르겠지만..
        // 샘플로 넘어온 html 에는 내용이 아래와 같은 태그 구조로 되어있었음..
        //--------------------------------------------------------------------------------
        //<div class="body">
        //    <div id="chapter_32339" class="chapter">
        //--------------------------------------------------------------------------------
        // 혹시라도 다른 html 태그 내에 내용이 존재하는 경우 다르게 지정해야함!
        var content_root = $(".body .chapter");
        
        // 모든 element 영역 하이라이트 해제
        content_root.find(".ipaprika_character_area").each(function () {

            $(this).css("color", $(this).attr("ipaprika_def_color"));
        });
    },

    /*****************************************************************
    * TTS 다음 페이지로 이동
    *****************************************************************/
    move_TTS_Next_Page: function () {

        var is_last_page = false; // 마지막 페이지인지 여부
        var move_scroll_left = $("body").scrollLeft() + $(window).width();
        
        $("body").animate({ scrollLeft: move_scroll_left }, 100);

        if (move_scroll_left + $(window).width() >= $(document).width()) is_last_page = true; // 마지막 페이지 임을 알림

        return is_last_page;
    },

    /*****************************************************************
    * Json 데이터 입력 시, 입력되지 않는 금칙어 문자를 입력되도록 치환해주는 함수
    *****************************************************************/
    convert_Json_Val: function (text) {

        var result = text.trim();
        result = result.replace(/\r/g, "\"\"r");
        result = result.replace(/\n/g, "\"\"n");
        result = result.replace(/\"/g, "\\\"\\\"");

        return result;
    }
};
