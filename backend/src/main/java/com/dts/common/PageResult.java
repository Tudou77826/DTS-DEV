package com.dts.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import com.baomidou.mybatisplus.core.metadata.IPage;

import java.util.List;

/**
 * 分页结果包装。
 */
@Data
@AllArgsConstructor
public class PageResult<T> {

    private List<T> list;
    private long total;
    private int page;
    private int size;
    private int totalPages;

    public static <T> PageResult<T> of(IPage<T> page) {
        return new PageResult<>(
                page.getRecords(),
                page.getTotal(),
                Math.toIntExact(page.getCurrent()),
                Math.toIntExact(page.getSize()),
                Math.toIntExact(page.getPages()));
    }

    public static <T, R> PageResult<R> of(IPage<T> page, List<R> mapped) {
        return new PageResult<>(
                mapped,
                page.getTotal(),
                Math.toIntExact(page.getCurrent()),
                Math.toIntExact(page.getSize()),
                Math.toIntExact(page.getPages()));
    }
}
