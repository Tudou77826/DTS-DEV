package com.dts.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DTS 系统级接入定制配置。
 *
 * <p>配置中的 value/key 是稳定技术契约，label、流程、主数据和功能开关
 * 可以按接入团队或外部系统进行定制。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "dts.customization")
public class DtsCustomizationProperties {

    private Profile profile = new Profile();
    private Branding branding = new Branding();
    private Terminology terminology = new Terminology();
    private List<ValueOption> roles = new ArrayList<>();
    private AdminConfig admin = new AdminConfig();
    private IssueModel issue = new IssueModel();
    private MasterData masterData = new MasterData();
    private Map<String, Boolean> features = new LinkedHashMap<>();
    private Map<String, Object> extensions = new LinkedHashMap<>();

    /**
     * 接入定制管理入口的共享密码（BCrypt 哈希）。
     * 系统不再维护管理员账号，改为由密码门禁签发短时管理员令牌。
     */
    @Data
    public static class AdminConfig {
        private String passwordHash;
    }

    @Data
    public static class Profile {
        private String id = "default";
        private String name = "默认接入配置";
        private String targetTeam;
        private String targetSystem;
    }

    @Data
    public static class Branding {
        private String productName = "问题管理平台";
        private String shortName = "DTS";
        private String loginTitle = "登录";
        private String loginSubtitle = "使用账号密码登录系统";
        private String primaryColor = "#2563eb";
        private boolean showDemoAccounts = true;
        private String demoAccountHint = "演示账号由接入配置提供";
    }

    @Data
    public static class Terminology {
        private String issue = "问题";
        private String product = "来源产品";
        private String module = "所属模块";
        private String version = "发现版本";
        private String domain = "问题领域";
        private String submitter = "提出人";
        private String assignee = "责任人";
    }

    @Data
    public static class ValueOption {
        private String value;
        private String label;
        private String color;
    }

    @Data
    public static class FieldOption {
        private String label;
        private String placeholder;
        private boolean required;
        private boolean visible = true;
    }

    @Data
    public static class CodeRule {
        private String prefix = "ISS";
        private String datePattern = "yyMMdd";
        private int sequenceDigits = 3;
    }

    @Data
    public static class IssueModel {
        private CodeRule code = new CodeRule();
        private String defaultPriority = "MEDIUM";
        private List<ValueOption> priorities = new ArrayList<>();
        private List<ValueOption> statuses = new ArrayList<>();
        private Map<String, FieldOption> fields = new LinkedHashMap<>();
        private Map<String, List<String>> transitions = new LinkedHashMap<>();
    }

    @Data
    public static class DomainOption {
        private String name;
        private String description;
    }

    @Data
    public static class TeamOption {
        private String key;
        private String name;
        private String description;
    }

    @Data
    public static class UserOption {
        private String employeeNo;
        private String username;
        private String displayName;
        private String role;
        private String team;
        private String avatarColor;
        private boolean active = true;
    }

    @Data
    public static class MasterData {
        private String syncMode = "merge";
        private List<TeamOption> teams = new ArrayList<>();
        private List<UserOption> users = new ArrayList<>();
        private List<String> modules = new ArrayList<>();
        /** 产品枚举（下拉选项，可按接入团队定制；允许自定义输入不受此限制） */
        private List<String> products = new ArrayList<>();
        /** 版本枚举（下拉选项，可按接入团队定制；允许自定义输入不受此限制） */
        private List<String> versions = new ArrayList<>();
        private List<DomainOption> domains = new ArrayList<>();
    }
}
