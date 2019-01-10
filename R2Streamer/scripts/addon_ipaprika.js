// version 2

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

        // 혹시라도 다른 html 태그 내에 내용이 존재하는 경우 다르게 지정해야함!
        var content_root = $("body");
        
        // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 제거 (해당 속성이 없을 경우 TTS 대상에서 제외됨)
        content_root.find(".ipaprika_character_area").each(function () {

            // TTS 커스텀 태그 영역 인덱스 번호 속성 제거
            var new_class = $(this).attr("class").replace(/-tts-item-idx-.*?-/g, "");
            $(this).attr("class", new_class);

			// TTS 커스텀 태그 영역 하이라이트 해제
			var matches = $(this).attr("class").match(/-tts-def-color-.*?-/g);
			if (matches) {
				var def_color = matches[0].replace("-tts-def-color-", "").replace("-", "");
				$(this).css("color", def_color);
			}
        });
		
		var scroll_root = $(window);

        // TTS 커스텀 태그 영역 설정 함수
        var set_TTS_Tag_Area = function (obj_root) {
			
			if (obj_root.html().indexOf("ipaprika_character_area") > -1) return;
			
            var is_tag = false;
            var result_content_inner = "";

            var arr_content_html_inner = obj_root.html().trim().split("");
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

            obj_root.html(result_content_inner);
        }
		
		// TTS 커스텀 태그 영역 설정
		set_TTS_Tag_Area(content_root);
		
        var tts_item_text = "";
        var tts_item_idx = 0;

        // TTS 커스텀 태그 영역에 설정된 인덱스 번호 속성 설정 함수
        var set_TTS_Tag_Index = function (obj_root) {
			
			// 'obj_root[0].getBoundingClientRect().left' 의 경우, 현재 스크롤 위치에서 왼쪽으로 벗어난 경우 마이너스 수치를 반환하고,
			// 'obj_root[0].getBoundingClientRect().right' 의 경우, 현재 스크롤 위치에서 오른쪽으로 벗어난 경우 '$(window).width()' 보다 큰 값을 반환한다.
			// 이런 부분을 활용해서 아래와 같이 현재 영역을 벗어났는지 체크하도록 하자!
			
			if (
				obj_root[0].getBoundingClientRect().left < 0
				&& obj_root[0].getBoundingClientRect().right < 0
			) {
				// 최측 영역을 벗어난 경우
				
				return;
			}
			
			if (
				obj_root[0].getBoundingClientRect().left > scroll_root.width()
				&& obj_root[0].getBoundingClientRect().right > scroll_root.width()
			) {
				// 우측 영역을 벗어난 경우
				
				return;
			}

            // tts 순서 번호 데이터 추가
            var new_class = $(obj_root).attr("class").replace(/-tts-item-idx-.*?-/g, "");
			new_class = new_class.trim();
            new_class += " -tts-item-idx-" + tts_item_idx + "-";
            $(obj_root).attr("class", new_class);

            var c = $(obj_root).text();

            var is_sentence_end = false;

            var matches = c.match(/\n/g);
            var new_lines = matches ? matches.length : 0;

            if (new_lines == 1) {

                // 줄바꿈 일 경우

                is_sentence_end = true;
            }

            if ($(obj_root).attr("class").match(/-tts-item-end-/g)) {

                // 문장의 종료를 알리는 라인피드 영역일 경우

                is_sentence_end = true;
            }

            if (
				c == "."
				|| c == "!"
				|| c == "?"
				|| c == "。" // 일본어의 경우 마침표를 이런식으로 지정하기도 함..
			) {

                // 문장의 끝을 알리는 문자에 도달한 경우

				// 다국어 TTS 지원으로 인해 기존 로직은 한글 TTS 에대해서만 정상 동작하기 때문에 아래 로직은 주석 처리함..
				is_sentence_end = true;

				/*
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
				*/
            }

            tts_item_text += c;

            if (is_sentence_end) {

                tts_item_text = "";

                // 설정된 하이라이트 영역에 읽을 내용이 없을 경우 대상에서 제외
                var tts_item_temp = content_root.find(".-tts-item-idx-" + tts_item_idx + "-");
                if (tts_item_temp.text().trim() == "") {

                    var new_class = $(obj_root).attr("class").replace(/-tts-item-idx-.*?-/g, "");
                    $(obj_root).attr("class", new_class);		
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
		if (tts_item_idx > 0) {
			
			result_json += "[";
			for (var idx = 0; idx <= tts_item_idx; idx++) {

				var ID = ".-tts-item-idx-" + idx + "-";
				var TEXT = "";
				content_root.find(ID).each(function () {

					TEXT += $(this).text();
				});
				if (idx > 0) result_json += ",";
				result_json += "{\"ID\": \"" + ID + "\", \"TEXT\": \"" + ADDON_IPAPRIKA.JS.convert_Json_Val(TEXT) + "\"}";
			}
			result_json += "]";
		}
		
		if (result_json == "") result_json = "[]";
		
		//result_json = JSON.parse(result_json); // Json 객체로 변환후 리턴하는게 최적이지만.. 여기서는 에러가 발생해서 실행되지 않는다.. 원인은 모르겠음.. -_-;
		return result_json;
    },

    /*****************************************************************
    * TTS 읽기중인 영역 하이라이트 처리
    *****************************************************************/
    set_TTS_Item_Highlight: function (id) {
        
        var content_root = $("body");
        
        // 모든 element 영역 하이라이트 해제
        content_root.find(".ipaprika_character_area").each(function () {

			var matches = $(this).attr("class").match(/-tts-def-color-.*?-/g);		
			if (matches) {
				var def_color = matches[0].replace("-tts-def-color-", "").replace("-", "");
				$(this).css("color", def_color);
			}
        });

        // 현재 element 영역 하이라이트 설정
        content_root.find(id).each(function () {
			var def_color = ADDON_IPAPRIKA.JS.convert_Color_Rgb_To_Hex($(this).css("color"));
			
            var new_class = $(this).attr("class").replace(/-tts-def-color-.*?-/g, "");
			new_class = new_class.trim();
            new_class += " -tts-def-color-" + def_color + "-";
			
            $(this).attr("class", new_class);
            $(this).css("color", "orange");
        });
    },

    /*****************************************************************
    * TTS 하이라이트 처리 영역 초기화
    *****************************************************************/
    remove_TTS_All_Highlight: function () {
        
        var content_root = $("body");
        
        // 모든 element 영역 하이라이트 해제
        content_root.find(".ipaprika_character_area").each(function () {

			var matches = $(this).attr("class").match(/-tts-def-color-.*?-/g);		
			if (matches) {
				var def_color = matches[0].replace("-tts-def-color-", "").replace("-", "");
				$(this).css("color", def_color);
			}
        });
    },

    /*****************************************************************
    * TTS 다음 페이지로 이동
    *****************************************************************/
    move_TTS_Next_Page: function () {
		
		var obj = $(window);

        var is_last_page = false; // 마지막 페이지인지 여부
        var move_scroll_left = obj.scrollLeft() + $(window).width();
        
        //obj.animate({ scrollLeft: move_scroll_left }, 100); // 이걸로 하면 애니메이션 효과 때문에 부럽게 넘어가긴 하지만.. 대상 객체가 준비 상태가 아니면 동작하지 않는다.. 이런 상황은 너무 비일비재하니 차라리 사용하지 않는 편이 좋다..
		window.scrollTo(move_scroll_left, 0);						

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
    },

    /*****************************************************************
    * Json 데이터 입력 시, 입력되지 않는 금칙어 문자를 입력되도록 치환해주는 함수
    *****************************************************************/
    convert_Color_Rgb_To_Hex: function (rgb) {

		var ctx = document.createElement('canvas').getContext('2d');
		ctx.strokeStyle = rgb;
		var hexColor = ctx.strokeStyle;
		delete ctx;

        return hexColor;
    }
};