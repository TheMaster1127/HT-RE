// DecompileHeadless.java
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.address.Address;

public class DecompileHeadless extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length == 0) return;

        String target = args[0];
        Function targetFunc = null;
        Address directAddr = null;

        // 1. Try resolving as Address (with PIE ImageBase auto-offset)
        try {
            long rawOffset = Long.parseUnsignedLong(target.replace("0x", ""), 16);
            
            // A. Try absolute address directly
            directAddr = toAddr(rawOffset);
            targetFunc = getFunctionAt(directAddr);

            // B. If not found, try adding Ghidra's ImageBase (for PIE binaries like 0x1149 -> 0x101149)
            if (targetFunc == null) {
                Address pieAddr = currentProgram.getImageBase().add(rawOffset);
                targetFunc = getFunctionAt(pieAddr);
                if (targetFunc == null) {
                    targetFunc = getFunctionContaining(pieAddr);
                }
            }
        } catch (Exception e) {}

        // 2. Try resolving by Name / Symbol
        if (targetFunc == null) {
            for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
                if (f.getName().equals(target) || f.getName().contains(target)) {
                    targetFunc = f;
                    break;
                }
            }
        }

        // 3. For raw/bare-metal sectionless binaries: Auto-create function at Entry Address if missing!
        if (targetFunc == null && directAddr != null) {
            try {
                disassemble(directAddr);
                targetFunc = createFunction(directAddr, "entry_point");
            } catch (Exception e) {}
        }

        System.out.println("=== GHIDRA_C_START ===");
        if (targetFunc == null) {
            System.out.println("// Error: Function not found in Ghidra for target: " + target);
        } else {
            DecompInterface decomp = new DecompInterface();
            decomp.openProgram(currentProgram);
            DecompileResults res = decomp.decompileFunction(targetFunc, 60, monitor);

            if (res.decompileCompleted() && res.getDecompiledFunction() != null) {
                System.out.println(res.getDecompiledFunction().getC());
            } else {
                System.out.println("// Decompiler error: " + res.getErrorMessage());
            }
        }
        System.out.println("=== GHIDRA_C_END ===");
        System.out.flush();
    }
}
