package com.dts.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内容清洗测试：富文本白名单清洗与纯文本提取，防存储型 XSS。
 */
class ContentSanitizerTest {

    private final ContentSanitizer sanitizer = new ContentSanitizer();

    @Test
    void richTextStripsScriptTags() {
        String cleaned = sanitizer.richText("<p>正常内容</p><script>alert('xss')</script>");
        assertFalse(cleaned.contains("<script"));
        assertTrue(cleaned.contains("正常内容"));
    }

    @Test
    void richTextRemovesJavascriptUrls() {
        String cleaned = sanitizer.richText("<a href=\"javascript:alert(1)\">点击</a>");
        assertFalse(cleaned.toLowerCase().contains("javascript:"));
    }

    @Test
    void richTextKeepsSafeFormatting() {
        String cleaned = sanitizer.richText("<p><b>加粗</b>与<a href=\"https://example.com\">链接</a></p>");
        assertTrue(cleaned.contains("<b>加粗</b>"));
        assertTrue(cleaned.contains("href=\"https://example.com\""));
    }

    @Test
    void plainTextExtractsTextAndDropsMarkup() {
        String text = sanitizer.plainText("<p>第一段</p><p>第二段 <script>x</script></p>");
        assertTrue(text.contains("第一段"));
        assertTrue(text.contains("第二段"));
        assertFalse(text.contains("<"));
    }

    @Test
    void hasTextIgnoresEmptyMarkup() {
        assertFalse(sanitizer.hasText("<p></p><br>"));
        assertTrue(sanitizer.hasText("<p>有内容</p>"));
    }

    @Test
    void nullInputYieldsNull() {
        assertNull(sanitizer.richText(null));
        assertNull(sanitizer.plainText(null));
        assertFalse(sanitizer.hasText(null));
    }
}
