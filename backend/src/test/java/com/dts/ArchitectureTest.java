package com.dts;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * 架构守护测试（ArchUnit）：把分层约定固化为测试，防止包结构腐化。
 *
 * <p>约定（针对性禁止，避免误伤有意的跨层引用）：
 * <ul>
 *   <li>controller 不得直接访问 mapper（数据访问必须经 service）；</li>
 *   <li>service 不得反向依赖 controller；</li>
 *   <li>mapper 不得依赖 service/controller（纯数据访问）；</li>
 *   <li>domain 是纯模型，不得依赖业务层；</li>
 *   <li>Rest Controller 必须位于 controller 包；</li>
 *   <li>包间无循环依赖。</li>
 * </ul>
 * common / config / security / dto 为支撑层，可被各层自由引用。</p>
 */
@AnalyzeClasses(packages = "com.dts")
class ArchitectureTest {

    private static final String CONTROLLER = "com.dts.controller";
    private static final String SERVICE = "com.dts.service";
    private static final String MAPPER = "com.dts.mapper";
    private static final String DOMAIN = "com.dts.domain";

    /** controller 不得直接触碰 mapper（数据访问必须经 service）。 */
    @ArchTest
    static final ArchRule controllers_should_not_depend_on_mappers =
            noClasses().that().resideInAPackage(CONTROLLER + "..")
                    .should().dependOnClassesThat().resideInAPackage(MAPPER + "..");

    /** service 不得反向依赖 controller。 */
    @ArchTest
    static final ArchRule services_should_not_depend_on_controllers =
            noClasses().that().resideInAPackage(SERVICE + "..")
                    .should().dependOnClassesThat().resideInAPackage(CONTROLLER + "..");

    /** mapper 是数据访问层，不得依赖 service/controller。 */
    @ArchTest
    static final ArchRule mappers_should_not_depend_on_business_layers =
            noClasses().that().resideInAPackage(MAPPER + "..")
                    .should().dependOnClassesThat().resideInAnyPackage(SERVICE + "..", CONTROLLER + "..");

    /** domain 是纯模型：不得依赖任何业务层。 */
    @ArchTest
    static final ArchRule domain_should_be_pure =
            noClasses().that().resideInAPackage(DOMAIN + "..")
                    .should().dependOnClassesThat()
                    .resideInAnyPackage(SERVICE + "..", CONTROLLER + "..", MAPPER + "..");

    /** Rest Controller 必须位于 controller 包（防止控制器散落到其他包）。 */
    @ArchTest
    static final ArchRule controllers_must_reside_in_controller_package =
            noClasses().that().areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
                    .should().resideOutsideOfPackage(CONTROLLER + "..");

    /** 无循环依赖（按一级子包切片：common/config/controller/domain/dto/mapper/security/service）。 */
    @ArchTest
    static final ArchRule no_cycles_between_packages =
            SlicesRuleDefinition.slices()
                    .matching("com.dts.(*)..")
                    .should().beFreeOfCycles();
}
