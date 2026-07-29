package com.dts.dto;

import lombok.Data;

/** 统计聚合投影：按某分组键的计数。 */
@Data
public class StatBucket {
    /** 分组键：状态串 或 实体ID */
    private String bucket;
    private Long cnt;
}
