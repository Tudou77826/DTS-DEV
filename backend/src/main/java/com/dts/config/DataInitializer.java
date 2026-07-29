package com.dts.config;

import com.dts.domain.*;
import com.dts.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 启动时初始化种子数据（仅在库为空时插入）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ProductRepository productRepository;
    private final ModuleRepository moduleRepository;
    private final ProductVersionRepository versionRepository;
    private final IssueDomainRepository domainRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("数据已存在，跳过种子初始化");
            return;
        }
        log.info("开始初始化种子数据...");

        Team team = teamRepository.save(Team.builder().name("网络安全组").description("问题排查与定位团队").build());

        // 用户（密码统一 123456）
        String pwd = passwordEncoder.encode("123456");
        User admin = save("admin", "A0001", "系统管理员", "ADMIN", pwd, team.getId());
        User leader = save("leader", "L0001", "张项目负责人", "LEADER", pwd, team.getId());
        User dev1 = save("wangwu", "D1001", "王五", "DEVELOPER", pwd, team.getId());
        User dev2 = save("zhaoliu", "D1002", "赵六", "DEVELOPER", pwd, team.getId());
        User dev3 = save("sunqi", "D1003", "孙七", "DEVELOPER", pwd, team.getId());
        User submitter = save("submitter", "S2001", "李提出人", "SUBMITTER", pwd, team.getId());

        // 产品
        Product hisec = productRepository.save(Product.builder().name("HiSec").description("安全网关产品").build());
        Product secospace = productRepository.save(Product.builder().name("SecoSpace").description("安全管理平台").build());

        // 模块
        ProductModule m1 = moduleRepository.save(ProductModule.builder().productId(hisec.getId()).name("入侵检测").build());
        ProductModule m2 = moduleRepository.save(ProductModule.builder().productId(hisec.getId()).name("流量清洗").build());
        ProductModule m3 = moduleRepository.save(ProductModule.builder().productId(hisec.getId()).name("日志审计").build());
        ProductModule m4 = moduleRepository.save(ProductModule.builder().productId(secospace.getId()).name("策略下发").build());

        // 版本
        ProductVersion v1 = versionRepository.save(ProductVersion.builder().productId(hisec.getId()).version("V500R020C00").build());
        ProductVersion v2 = versionRepository.save(ProductVersion.builder().productId(hisec.getId()).version("V500R020C10").build());
        ProductVersion v3 = versionRepository.save(ProductVersion.builder().productId(hisec.getId()).version("V500R021C00").build());
        versionRepository.save(ProductVersion.builder().productId(secospace.getId()).version("V200R001C00").build());

        // 问题领域
        domainRepository.save(IssueDomain.builder().name("功能缺陷").build());
        domainRepository.save(IssueDomain.builder().name("性能问题").build());
        domainRepository.save(IssueDomain.builder().name("兼容性").build());
        domainRepository.save(IssueDomain.builder().name("配置问题").build());
        domainRepository.save(IssueDomain.builder().name("安全漏洞").build());

        log.info("种子数据初始化完成: 6 个用户、2 个产品、4 个模块、4 个版本、5 个领域");
        log.info("登录账号: admin/leader/wangwu/zhaoliu/sunqi/submitter，密码均为 123456");
    }

    private User save(String username, String empNo, String name, String role, String pwd, Long teamId) {
        String[] colors = {"#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"};
        int idx = List.of("admin", "leader", "wangwu", "zhaoliu", "sunqi", "submitter").indexOf(username);
        return userRepository.save(User.builder()
                .employeeNo(empNo)
                .username(username)
                .displayName(name)
                .password(pwd)
                .role(role)
                .teamId(teamId)
                .avatarColor(colors[Math.max(0, idx)])
                .active(true)
                .build());
    }
}
