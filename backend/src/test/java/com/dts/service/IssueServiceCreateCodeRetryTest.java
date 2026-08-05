package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.Issue;
import com.dts.dto.IssueDtos;
import com.dts.mapper.CommentMapper;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.IssueProgressMapper;
import com.dts.mapper.OperationLogMapper;
import com.dts.security.LoginUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 问题编号并发冲突重试测试：当日最大序号 +1 在并发下可能碰撞唯一索引，
 * 冲突时应重新取号重试，而不是直接失败。
 */
class IssueServiceCreateCodeRetryTest {

    private IssueMapper issueMapper;
    private IssueService issueService;

    @BeforeEach
    void setUp() {
        issueMapper = mock(IssueMapper.class);
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        // 默认优先级 MEDIUM 必须存在于 priorities 列表中，否则 normalPriority 校验失败
        DtsCustomizationProperties.ValueOption medium = new DtsCustomizationProperties.ValueOption();
        medium.setValue("MEDIUM");
        medium.setLabel("中");
        customization.getIssue().setPriorities(java.util.List.of(medium));

        IssuePermissionService permissionService = mock(IssuePermissionService.class);
        NotificationService notificationService = mock(NotificationService.class);
        LookupService lookup = mock(LookupService.class);
        FeatureGuard featureGuard = new FeatureGuard(customization);
        ContentSanitizer sanitizer = new ContentSanitizer();

        issueService = new IssueService(
                issueMapper,
                mock(IssueProgressMapper.class),
                mock(CommentMapper.class),
                mock(OperationLogMapper.class),
                lookup,
                permissionService,
                notificationService,
                sanitizer,
                customization,
                featureGuard);

        LoginUser user = new LoginUser(1L, "zhangsan", "张三", "SUBMITTER", "E001", "#000000");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private IssueDtos.IssueSaveRequest request() {
        IssueDtos.IssueSaveRequest req = new IssueDtos.IssueSaveRequest();
        req.setModuleId(1L);
        req.setTitle("测试标题");
        req.setDescription("<p>测试描述</p>");
        return req;
    }

    @Test
    void retriesWithNewCodeWhenCodeUniqueConflictOccurs() {
        // 第一次插入返回冲突（模拟另一并发请求已占用该编号），第二次成功
        String maxCode = "ISS-" + java.time.LocalDate.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd")) + "-003";
        when(issueMapper.selectMaxCodeByPrefix(Mockito.anyString())).thenReturn(maxCode);
        when(issueMapper.insert(any(Issue.class))).thenThrow(new DuplicateKeyException("duplicate")).thenReturn(1);

        issueService.create(request());

        verify(issueMapper, times(2)).insert(any(Issue.class));
        verify(issueMapper, times(2)).selectMaxCodeByPrefix(Mockito.anyString());
    }

    @Test
    void givesUpAfterRepeatedConflicts() {
        // 每次取号都得到 002（无碰撞者），但 insert 始终冲突 → 重试 3 次后放弃
        String maxCode = "ISS-" + java.time.LocalDate.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd")) + "-001";
        when(issueMapper.selectMaxCodeByPrefix(Mockito.anyString())).thenReturn(maxCode);
        when(issueMapper.insert(any(Issue.class))).thenThrow(new DuplicateKeyException("duplicate"));

        assertThrows(BusinessException.class, () -> issueService.create(request()));
        verify(issueMapper, times(3)).insert(any(Issue.class));
    }
}
