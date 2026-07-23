import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    try:
        async with engine.connect() as conn:
            # Query recent tasks
            res = await conn.execute(text("SELECT id, title, description, brand_id, status FROM tasks ORDER BY id DESC"))
            rows = res.fetchall()
            
            with open("check_results.txt", "w", encoding="utf-8") as f:
                f.write("--- ALL TASKS ---\n")
                for r in rows:
                    f.write(f"ID: {r[0]} | Title: {r[1]} | Brand ID: {r[3]} | Status: {r[4]}\n")
                    f.write(f"Description: {str(r[2])[:300]}\n")
                    f.write("-" * 40 + "\n")
                
                # Query social accounts
                res_s = await conn.execute(text("SELECT id, brand_id, platform, platform_account_id FROM social_accounts"))
                sa = res_s.fetchall()
                f.write("\n--- LINKED SOCIAL ACCOUNTS ---\n")
                for s in sa:
                    f.write(f"ID: {s[0]} | Brand ID: {s[1]} | Platform: {s[2]} | Platform Account ID: {s[3]}\n")
                    
    except Exception as e:
        with open("check_results.txt", "w", encoding="utf-8") as f:
            f.write(f"ERROR: {e}\n")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
