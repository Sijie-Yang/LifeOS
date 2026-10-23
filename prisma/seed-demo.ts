import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = (tx as unknown as Record<string, { count(): Promise<number> }>)[model.name[0].toLowerCase() + model.name.slice(1)];
      if (await delegate.count()) throw new Error("Demo seed requires an empty workspace. Existing data has not been changed.");
    }
    const goal = await tx.lifeGoal.create({data:{title:"建立可持续的学习习惯",area:"growth",horizon:"year"}});
    const project = await tx.project.create({data:{name:"我的第一个项目",status:"ACTIVE",goalId:goal.id,description:"把一个目标拆成能在今天完成的小步骤。"}});
    await tx.projectPlanStep.create({data:{projectId:project.id,title:"写下本周最重要的一步",sortOrder:0}});
    await tx.habit.create({data:{name:"专注学习",frequency:"daily",color:"#6366f1",projectId:project.id}});
    const category=await tx.contactCategory.create({data:{name:"朋友",color:"#059669"}});
    await tx.contact.create({data:{name:"示例联系人",email:"hello@example.com",categoryId:category.id,notes:"这是演示资料，可以编辑或删除。"}});
    await tx.taskItem.create({data:{title:"安排本周的一次专注时段",projectId:project.id}});
    await tx.note.create({data:{title:"欢迎使用 LifeOS",content:"从今日计划开始：选择一件重要的事，留出时间，完成后复盘。",projectId:project.id}});
  });
  console.log("Demo workspace created. No personal data is included.");
}
main().catch((error)=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
