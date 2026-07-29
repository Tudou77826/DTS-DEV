package com.dts.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dts.common.BusinessException;
import com.dts.common.PageResult;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.*;
import com.dts.dto.IssueDtos;
import com.dts.dto.FeatureDtos;
import com.dts.dto.IssueExportRow;
import com.dts.dto.IssueVo;
import com.dts.mapper.CommentMapper;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.IssueProgressMapper;
import com.dts.mapper.OperationLogMapper;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueMapper issueMapper;
    private final IssueProgressMapper progressMapper;
    private final CommentMapper commentMapper;
    private final OperationLogMapper operationLogMapper;
    private final LookupService lookup;
    private final IssuePermissionService permissionService;
    private final NotificationService notificationService;
    private final ContentSanitizer sanitizer;
    private final DtsCustomizationProperties customization;

    // ───────────────────────── 创建/编辑 ─────────────────────────

    @Transactional
    public IssueVo create(IssueDtos.IssueSaveRequest req) {
        LoginUser me = SecurityUtil.current();
        String title = sanitizeTitle(req.getTitle());
        String description = sanitizer.richText(req.getDescription());
        if (!sanitizer.hasText(description)) throw new BusinessException("问题描述不能为空");
        Issue issue = Issue.builder()
                .code(generateCode())
                .raisedAt(LocalDateTime.now())
                .moduleId(req.getModuleId())
                .title(title)
                .description(description)
                .searchKeywords(sanitizer.plainText(req.getSearchKeywords()))
                .envInfo(sanitizer.plainText(req.getEnvInfo()))
                .vpnInfo(sanitizer.plainText(req.getVpnInfo()))
                .domainId(req.getDomainId())
                .productId(req.getProductId())
                .submitterId(me.getId())
                .submitterNo(req.getSubmitterNo() != null ? req.getSubmitterNo() : me.getEmployeeNo())
                .foundVersionId(req.getFoundVersionId())
                .priority(normalizePriority(req.getPriority()))
                .status(IssueStatus.PENDING_ASSIGN)
                .collaboratorIds("")
                .build();
        issueMapper.insert(issue);

        logOperation(issue.getId(), me.getId(), "CREATE", "status", null, IssueStatus.PENDING_ASSIGN, "创建问题");
        return toVo(issue);
    }

    @Transactional
    public IssueVo update(IssueDtos.IssueSaveRequest req) {
        if (req.getId() == null) throw new BusinessException("问题ID不能为空");
        Issue issue = require(req.getId());
        if (req.getModuleId() != null) issue.setModuleId(req.getModuleId());
        permissionService.requireParticipantOrLeader(issue);
        if (req.getTitle() != null) issue.setTitle(sanitizeTitle(req.getTitle()));
        if (req.getDescription() != null) {
            String description = sanitizer.richText(req.getDescription());
            if (!sanitizer.hasText(description)) throw new BusinessException("问题描述不能为空");
            issue.setDescription(description);
        }
        if (req.getSearchKeywords() != null) issue.setSearchKeywords(sanitizer.plainText(req.getSearchKeywords()));
        if (req.getEnvInfo() != null) issue.setEnvInfo(sanitizer.plainText(req.getEnvInfo()));
        if (req.getVpnInfo() != null) issue.setVpnInfo(sanitizer.plainText(req.getVpnInfo()));
        if (req.getDomainId() != null) issue.setDomainId(req.getDomainId());
        if (req.getProductId() != null) issue.setProductId(req.getProductId());
        if (req.getFoundVersionId() != null) issue.setFoundVersionId(req.getFoundVersionId());
        if (req.getPriority() != null) issue.setPriority(normalizePriority(req.getPriority()));
        issueMapper.updateById(issue);
        return toVo(issue);
    }

    // ───────────────────────── 查询 ─────────────────────────

    @Transactional(readOnly = true)
    public PageResult<IssueVo> page(IssueDtos.IssueQuery q) {
        LambdaQueryWrapper<Issue> wrapper = buildQueryWrapper(q);
        IPage<Issue> result = issueMapper.selectPage(
                new Page<>(Math.max(1, q.getPage()), normalizePageSize(q.getSize())), wrapper);
        return PageResult.of(result, toVoList(result.getRecords()));
    }

    private LambdaQueryWrapper<Issue> buildQueryWrapper(IssueDtos.IssueQuery q) {
        LambdaQueryWrapper<Issue> wrapper = new LambdaQueryWrapper<>();
        if (q.getKeyword() != null && !q.getKeyword().isBlank()) {
            String keyword = q.getKeyword().trim();
            wrapper.and(w -> w.like(Issue::getCode, keyword)
                    .or().like(Issue::getTitle, keyword)
                    .or().like(Issue::getDescription, keyword)
                    .or().like(Issue::getSearchKeywords, keyword));
        }
        wrapper.eq(q.getModuleId() != null, Issue::getModuleId, q.getModuleId())
                .eq(q.getProductId() != null, Issue::getProductId, q.getProductId())
                .eq(q.getDomainId() != null, Issue::getDomainId, q.getDomainId())
                .eq(q.getStatus() != null && !q.getStatus().isBlank(), Issue::getStatus, q.getStatus())
                .eq(q.getSubmitterId() != null, Issue::getSubmitterId, q.getSubmitterId())
                .eq(q.getAssigneeId() != null, Issue::getAssigneeId, q.getAssigneeId())
                .eq(q.getFoundVersionId() != null, Issue::getFoundVersionId, q.getFoundVersionId())
                .ge(q.getCreatedFrom() != null, Issue::getCreatedAt, q.getCreatedFrom())
                .le(q.getCreatedTo() != null, Issue::getCreatedAt, q.getCreatedTo())
                .apply(q.getInvestigateVersionId() != null,
                        "EXISTS (SELECT 1 FROM version_investigation vi " +
                                "WHERE vi.issue_id = issue.id AND vi.version_id = {0})",
                        q.getInvestigateVersionId())
                .orderByDesc(Issue::getCreatedAt);
        return wrapper;
    }

    @Transactional(readOnly = true)
    public Issue get(Long id) {
        return require(id);
    }

    @Transactional(readOnly = true)
    public IssueVo detail(Long id) {
        return toVo(require(id));
    }

    private Issue require(Long id) {
        Issue issue = issueMapper.selectById(id);
        if (issue == null) {
            throw new BusinessException("问题不存在: " + id);
        }
        return issue;
    }

    // ───────────────────────── 分配/转派 ─────────────────────────

    @Transactional
    public IssueVo assign(Long issueId, IssueDtos.AssignRequest req) {
        permissionService.requireLeader();
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);

        if (req.getAssigneeId() == null) throw new BusinessException("责任人不能为空");
        lookup.requireAssignableUser(req.getAssigneeId());
        Long oldAssignee = issue.getAssigneeId();
        issue.setAssigneeId(req.getAssigneeId());
        logOperation(issueId, me.getId(), "ASSIGNEE", "assigneeId",
                oldAssignee == null ? null : String.valueOf(oldAssignee),
                String.valueOf(req.getAssigneeId()), "分配责任人");
        if (req.getCollaboratorIds() != null) {
            issue.setCollaboratorIds(joinIds(req.getCollaboratorIds()));
        }
        if (req.getPriority() != null) {
            String old = issue.getPriority();
            String priority = normalizePriority(req.getPriority());
            issue.setPriority(priority);
            logOperation(issueId, me.getId(), "PRIORITY", "priority", old, priority, "调整优先级");
        }
        if (req.getPlanFinishAt() != null) {
            issue.setPlanFinishAt(req.getPlanFinishAt());
        }
        // 分配时若无定位开始时间，状态切到 待定位
        if (req.getStatus() != null) {
            if (!List.of(IssueStatus.PENDING_LOCATE, IssueStatus.LOCATING).contains(req.getStatus())) {
                throw new BusinessException("分配时仅允许流转到待定位或定位中");
            }
            applyStatus(issue, req.getStatus(), me.getId(), req.getRemark());
        } else if (IssueStatus.PENDING_ASSIGN.equals(issue.getStatus()) && req.getAssigneeId() != null) {
            applyStatus(issue, IssueStatus.PENDING_LOCATE, me.getId(), req.getRemark());
        }
        issueMapper.updateById(issue);
        List<Long> recipients = new ArrayList<>();
        recipients.add(issue.getAssigneeId());
        recipients.addAll(parseIds(issue.getCollaboratorIds()));
        notificationService.notifyUsers(recipients, "ASSIGN", "问题已分配：" + issue.getCode(),
                issue.getTitle(), "/issues/" + issue.getId());
        return toVo(issue);
    }

    // ───────────────────────── 状态变更 ─────────────────────────

    @Transactional
    public IssueVo changeStatus(Long issueId, IssueDtos.StatusChangeRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);
        String remark = sanitizer.plainText(req.getRemark());
        permissionService.requireTransition(issue, req.getStatus(), remark);
        applyStatus(issue, req.getStatus(), me.getId(), remark);
        issueMapper.updateById(issue);
        notificationService.notifyUsers(Arrays.asList(issue.getSubmitterId(), issue.getAssigneeId()),
                "STATUS", "问题状态已更新：" + issue.getCode(),
                issue.getStatus(), "/issues/" + issue.getId());
        return toVo(issue);
    }

    private void applyStatus(Issue issue, String newStatus, Long operatorId, String remark) {
        if (!IssueStatus.isValid(newStatus)) {
            throw new BusinessException("非法状态: " + newStatus);
        }
        String old = issue.getStatus();
        if (old.equals(newStatus)) return;

        // 记录定位开始
        if (IssueStatus.LOCATING.equals(newStatus) && issue.getLocatedAt() == null) {
            issue.setLocatedAt(LocalDateTime.now());
        }
        // 记录解决时间
        if (IssueStatus.RESOLVED.equals(newStatus)) {
            issue.setResolvedAt(LocalDateTime.now());
        }
        // 关闭
        if (IssueStatus.CLOSED.equals(newStatus) && issue.getClosedAt() == null) {
            issue.setClosedAt(LocalDateTime.now());
            if (issue.getResolvedAt() == null) issue.setResolvedAt(LocalDateTime.now());
        }
        // 重新打开
        if (IssueStatus.REOPENED.equals(newStatus)) {
            issue.setClosedAt(null);
            issue.setResolvedAt(null);
        }
        issue.setStatus(newStatus);
        logOperation(issue.getId(), operatorId, "STATUS", "status", old, newStatus,
                remark != null ? remark : null);
    }

    // ───────────────────────── 进展记录 ─────────────────────────

    @Transactional
    public IssueProgress addProgress(Long issueId, IssueDtos.ProgressRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);
        permissionService.requireParticipantOrLeader(issue);
        String content = sanitizer.plainText(req.getContent());
        if (content == null || content.isBlank()) throw new BusinessException("内容不能为空");

        IssueProgress p = IssueProgress.builder()
                .issueId(issueId)
                .authorId(me.getId())
                .type(req.getType())
                .content(content)
                .build();
        progressMapper.insert(p);

        // 同步汇总字段 + 状态联动
        if (req.isSyncToIssue()) {
            switch (req.getType()) {
                case "PROGRESS" -> issue.setLatestProgress(content);
                case "ROOT_CAUSE" -> issue.setRootCause(content);
                case "RESOLUTION" -> issue.setResolution(content);
                case "WORKAROUND" -> issue.setWorkaround(content);
                default -> { /* VERIFY 等不更新汇总 */ }
            }
            // 首次记录进展时若在 待定位，则进入 定位中
            if (IssueStatus.PENDING_LOCATE.equals(issue.getStatus())) {
                permissionService.requireTransition(issue, IssueStatus.LOCATING, "开始定位");
                applyStatus(issue, IssueStatus.LOCATING, me.getId(), "开始定位");
            }
            issueMapper.updateById(issue);
        }
        logOperation(issueId, me.getId(), "PROGRESS", req.getType(), null, null, content);
        notificationService.notifyUsers(Arrays.asList(issue.getSubmitterId(), issue.getAssigneeId()),
                "PROGRESS", "问题有新进展：" + issue.getCode(), content, "/issues/" + issueId);
        return p;
    }

    @Transactional(readOnly = true)
    public List<IssueProgress> progressTimeline(Long issueId) {
        return progressMapper.selectList(new LambdaQueryWrapper<IssueProgress>()
                .eq(IssueProgress::getIssueId, issueId)
                .orderByAsc(IssueProgress::getCreatedAt));
    }

    // ───────────────────────── 评论 ─────────────────────────

    @Transactional
    public Comment addComment(Long issueId, IssueDtos.CommentRequest req) {
        LoginUser me = SecurityUtil.current();
        Issue issue = require(issueId);
        permissionService.requireParticipantOrLeader(issue);
        String content = sanitizer.plainText(req.getContent());
        if (content == null || content.isBlank()) throw new BusinessException("评论内容不能为空");
        Comment c = Comment.builder()
                .issueId(issueId)
                .authorId(me.getId())
                .content(content)
                .mentionIds(joinIds(req.getMentionIds()))
                .build();
        commentMapper.insert(c);
        List<Long> recipients = new ArrayList<>();
        if (req.getMentionIds() != null) recipients.addAll(req.getMentionIds());
        recipients.add(issue.getSubmitterId());
        recipients.add(issue.getAssigneeId());
        notificationService.notifyUsers(recipients, "COMMENT", "问题有新评论：" + issue.getCode(),
                content, "/issues/" + issueId);
        return c;
    }

    @Transactional(readOnly = true)
    public List<Comment> comments(Long issueId) {
        return commentMapper.selectList(new LambdaQueryWrapper<Comment>()
                .eq(Comment::getIssueId, issueId)
                .orderByAsc(Comment::getCreatedAt));
    }

    // ───────────────────────── 操作日志 ─────────────────────────

    @Transactional(readOnly = true)
    public List<OperationLog> operations(Long issueId) {
        return operationLogMapper.selectList(new LambdaQueryWrapper<OperationLog>()
                .eq(OperationLog::getIssueId, issueId)
                .orderByAsc(OperationLog::getCreatedAt));
    }

    @Transactional
    public void logOperation(Long issueId, Long operatorId, String action, String field,
                             String oldValue, String newValue, String remark) {
        OperationLog log = OperationLog.builder()
                .issueId(issueId)
                .operatorId(operatorId)
                .action(action)
                .field(field)
                .oldValue(oldValue)
                .newValue(newValue)
                .remark(remark)
                .build();
        operationLogMapper.insert(log);
    }

    @Transactional
    public FeatureDtos.BatchResult batchAssign(FeatureDtos.BatchAssignRequest request) {
        permissionService.requireLeader();
        List<String> errors = new ArrayList<>();
        int succeeded = 0;
        for (Long issueId : new LinkedHashSet<>(request.getIssueIds())) {
            try {
                IssueDtos.AssignRequest assign = new IssueDtos.AssignRequest();
                assign.setAssigneeId(request.getAssigneeId());
                assign.setCollaboratorIds(request.getCollaboratorIds());
                assign.setPriority(request.getPriority());
                assign.setPlanFinishAt(request.getPlanFinishAt());
                assign.setRemark(request.getRemark());
                assign(issueId, assign);
                succeeded++;
            } catch (BusinessException e) {
                errors.add(issueId + ": " + e.getMessage());
            }
        }
        return batchResult(succeeded, errors);
    }

    @Transactional
    public FeatureDtos.BatchResult batchClose(FeatureDtos.BatchCloseRequest request) {
        List<String> errors = new ArrayList<>();
        int succeeded = 0;
        for (Long issueId : new LinkedHashSet<>(request.getIssueIds())) {
            try {
                IssueDtos.StatusChangeRequest status = new IssueDtos.StatusChangeRequest();
                status.setStatus(IssueStatus.CLOSED);
                status.setRemark(request.getRemark());
                changeStatus(issueId, status);
                succeeded++;
            } catch (BusinessException e) {
                errors.add(issueId + ": " + e.getMessage());
            }
        }
        return batchResult(succeeded, errors);
    }

    public List<IssueExportRow> exportRows(IssueDtos.IssueQuery query) {
        List<IssueVo> issues = toVoList(issueMapper.selectList(buildQueryWrapper(query).last("LIMIT 10000")));
        return issues.stream().map(issue -> {
            IssueExportRow row = new IssueExportRow();
            row.setCode(issue.getCode());
            row.setTitle(issue.getTitle());
            row.setDescription(sanitizer.plainText(issue.getDescription()));
            row.setProduct(issue.getProductName());
            row.setModule(issue.getModuleName());
            row.setFoundVersion(issue.getFoundVersionName());
            row.setStatus(issue.getStatus());
            row.setPriority(issue.getPriority());
            row.setSubmitter(issue.getSubmitterName());
            row.setAssignee(issue.getAssigneeName());
            row.setCreatedAt(issue.getCreatedAt());
            row.setPlanFinishAt(issue.getPlanFinishAt());
            row.setResolvedAt(issue.getResolvedAt());
            row.setClosedAt(issue.getClosedAt());
            return row;
        }).toList();
    }

    // ───────────────────────── 我的任务 ─────────────────────────

    @Transactional(readOnly = true)
    public java.util.Map<String, Long> mySummary() {
        LoginUser me = SecurityUtil.current();
        java.util.Map<String, Long> m = new HashMap<>();
        m.put("pending", issueMapper.selectCount(new LambdaQueryWrapper<Issue>()
                .eq(Issue::getAssigneeId, me.getId())
                .in(Issue::getStatus, IssueStatus.ACTIVE)));
        m.put("todayNew", issueMapper.selectCount(new LambdaQueryWrapper<Issue>()
                .eq(Issue::getAssigneeId, me.getId())
                .ge(Issue::getCreatedAt, LocalDateTime.now().toLocalDate().atStartOfDay())));
        m.put("overdue", (long) issueMapper.findOverdue(LocalDateTime.now()).stream()
                .filter(i -> me.getId().equals(i.getAssigneeId())).count());
        return m;
    }

    @Transactional(readOnly = true)
    public PageResult<IssueVo> myTasks(String tab, int page, int size) {
        LoginUser me = SecurityUtil.current();
        String userId = String.valueOf(me.getId());
        LambdaQueryWrapper<Issue> wrapper = new LambdaQueryWrapper<>();
        wrapper.and(w -> w.eq(Issue::getAssigneeId, me.getId())
                .or(nested -> nested.eq(Issue::getCollaboratorIds, userId)
                        .or().likeRight(Issue::getCollaboratorIds, userId + ",")
                        .or().likeLeft(Issue::getCollaboratorIds, "," + userId)
                        .or().like(Issue::getCollaboratorIds, "," + userId + ",")));

        List<String> statuses = switch (tab == null ? "" : tab) {
            case "pending_locate" -> List.of(IssueStatus.PENDING_LOCATE, IssueStatus.PENDING_ASSIGN);
            case "locating" -> List.of(IssueStatus.LOCATING);
            case "need_info" -> List.of(IssueStatus.NEED_INFO);
            case "pending_verify" -> List.of(IssueStatus.PENDING_VERIFY);
            case "overdue" -> List.of();
            case "done" -> IssueStatus.TERMINAL;
            default -> IssueStatus.ACTIVE;
        };
        if ("overdue".equals(tab)) {
            wrapper.isNotNull(Issue::getPlanFinishAt)
                    .lt(Issue::getPlanFinishAt, LocalDateTime.now())
                    .in(Issue::getStatus, IssueStatus.ACTIVE);
        } else if (!statuses.isEmpty()) {
            wrapper.in(Issue::getStatus, statuses);
        }
        wrapper.orderByDesc(Issue::getCreatedAt);

        IPage<Issue> result = issueMapper.selectPage(
                new Page<>(Math.max(1, page), normalizePageSize(size)), wrapper);
        return PageResult.of(result, toVoList(result.getRecords()));
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private String generateCode() {
        DtsCustomizationProperties.CodeRule rule = customization.getIssue().getCode();
        String prefix = rule.getPrefix() + "-" + java.time.LocalDate.now()
                .format(java.time.format.DateTimeFormatter.ofPattern(rule.getDatePattern())) + "-";
        String maxCode = issueMapper.selectMaxCodeByPrefix(prefix + "%");
        long next = 1;
        if (maxCode != null && maxCode.startsWith(prefix)) {
            try {
                next = Long.parseLong(maxCode.substring(prefix.length())) + 1;
            } catch (NumberFormatException e) {
                log.warn("忽略非法问题编号: {}", maxCode);
            }
        }
        int digits = Math.max(1, Math.min(9, rule.getSequenceDigits()));
        long max = (long) Math.pow(10, digits) - 1;
        if (next > max) throw new BusinessException("当日问题编号已超过 " + max);
        return String.format("%s%0" + digits + "d", prefix, next);
    }

    private long normalizePageSize(int size) {
        return Math.min(200, Math.max(1, size));
    }

    private FeatureDtos.BatchResult batchResult(int succeeded, List<String> errors) {
        FeatureDtos.BatchResult result = new FeatureDtos.BatchResult();
        result.setSucceeded(succeeded);
        result.setFailed(errors.size());
        result.setErrors(errors);
        return result;
    }

    private String joinIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "";
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> parseIds(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(Long::valueOf).toList();
    }

    private String sanitizeTitle(String rawTitle) {
        String title = sanitizer.plainText(rawTitle);
        if (title == null || title.isBlank()) throw new BusinessException("问题标题不能为空");
        if (title.length() > 255) throw new BusinessException("问题标题不能超过255个字符");
        return title;
    }

    private String normalizePriority(String rawPriority) {
        String priority = rawPriority == null || rawPriority.isBlank()
                ? customization.getIssue().getDefaultPriority()
                : rawPriority.trim().toUpperCase(Locale.ROOT);
        boolean supported = customization.getIssue().getPriorities().stream()
                .anyMatch(option -> priority.equals(option.getValue()));
        if (!supported) throw new BusinessException("不支持的优先级: " + priority);
        return priority;
    }

    // ───────────────────────── VO 组装 ─────────────────────────

    public IssueVo toVo(Issue issue) {
        return toVoList(List.of(issue)).get(0);
    }

    public List<IssueVo> toVoList(List<Issue> issues) {
        if (issues.isEmpty()) return List.of();
        Set<Long> userIds = new HashSet<>();
        Set<Long> moduleIds = new HashSet<>();
        Set<Long> productIds = new HashSet<>();
        Set<Long> versionIds = new HashSet<>();
        Set<Long> domainIds = new HashSet<>();
        for (Issue i : issues) {
            addNullable(userIds, i.getSubmitterId(), i.getAssigneeId());
            addNullable(moduleIds, i.getModuleId());
            addNullable(productIds, i.getProductId());
            addNullable(versionIds, i.getFoundVersionId());
            addNullable(domainIds, i.getDomainId());
            parseIds(i.getCollaboratorIds()).forEach(userIds::add);
        }
        var userMap = lookup.userNames(userIds);
        var moduleMap = lookup.moduleNames(moduleIds);
        var productMap = lookup.productNames(productIds);
        var versionMap = lookup.versionNames(versionIds);

        return issues.stream().map(i -> {
            IssueVo vo = new IssueVo();
            vo.setId(i.getId());
            vo.setCode(i.getCode());
            vo.setRaisedAt(i.getRaisedAt());
            vo.setCreatedAt(i.getCreatedAt());
            vo.setUpdatedAt(i.getUpdatedAt());
            vo.setModuleId(i.getModuleId());
            vo.setModuleName(safeGet(moduleMap, i.getModuleId()));
            vo.setTitle(i.getTitle());
            vo.setDescription(i.getDescription());
            vo.setSearchKeywords(i.getSearchKeywords());
            vo.setEnvInfo(i.getEnvInfo());
            vo.setVpnInfo(i.getVpnInfo());
            vo.setDomainId(i.getDomainId());
            vo.setDomainName(lookup.domainName(i.getDomainId()));
            vo.setProductId(i.getProductId());
            vo.setProductName(safeGet(productMap, i.getProductId()));
            vo.setSubmitterId(i.getSubmitterId());
            vo.setSubmitterName(safeGet(userMap, i.getSubmitterId()));
            vo.setSubmitterNo(i.getSubmitterNo());
            vo.setFoundVersionId(i.getFoundVersionId());
            vo.setFoundVersionName(safeGet(versionMap, i.getFoundVersionId()));
            vo.setPriority(i.getPriority());
            vo.setStatus(i.getStatus());
            vo.setAssigneeId(i.getAssigneeId());
            vo.setAssigneeName(safeGet(userMap, i.getAssigneeId()));
            List<Long> collabs = parseIds(i.getCollaboratorIds());
            vo.setCollaboratorIds(collabs);
            vo.setCollaboratorNames(collabs.stream().map(id -> safeGet(userMap, id)).toList());
            vo.setLatestProgress(i.getLatestProgress());
            vo.setRootCause(i.getRootCause());
            vo.setResolution(i.getResolution());
            vo.setWorkaround(i.getWorkaround());
            vo.setPlanFinishAt(i.getPlanFinishAt());
            vo.setLocatedAt(i.getLocatedAt());
            vo.setResolvedAt(i.getResolvedAt());
            vo.setClosedAt(i.getClosedAt());
            if (i.getLocatedAt() != null) {
                LocalDateTime end = i.getResolvedAt() != null ? i.getResolvedAt() : LocalDateTime.now();
                vo.setLocateDurationMin(Duration.between(i.getLocatedAt(), end).toMinutes());
            }
            vo.setOverdue(i.getPlanFinishAt() != null
                    && i.getPlanFinishAt().isBefore(LocalDateTime.now())
                    && !IssueStatus.TERMINAL.contains(i.getStatus()));
            return vo;
        }).toList();
    }

    private void addNullable(Set<Long> set, Long... ids) {
        for (Long id : ids) if (id != null) set.add(id);
    }

    /** 不可变 Map（Map.of）不允许 null 键，统一做空值保护。 */
    private String safeGet(Map<Long, String> map, Long key) {
        return key == null ? null : map.get(key);
    }
}
