package com.dts.service;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

/** 统一清洗来自用户的富文本和纯文本，避免存储型 XSS。 */
@Component
public class ContentSanitizer {

    private final Safelist richTextSafelist = Safelist.relaxed()
            .addAttributes("a", "target", "rel")
            .addProtocols("a", "href", "http", "https", "mailto")
            .addProtocols("img", "src", "http", "https");

    public String richText(String input) {
        if (input == null) return null;
        return Jsoup.clean(input, richTextSafelist);
    }

    public String plainText(String input) {
        if (input == null) return null;
        return Jsoup.parse(input).text();
    }

    public boolean hasText(String html) {
        return html != null && !Jsoup.parse(html).text().isBlank();
    }
}
