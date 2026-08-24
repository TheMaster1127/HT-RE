// DecompileAll.java
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.address.Address;

public class DecompileAll extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        FunctionIterator funcs = currentProgram.getFunctionManager().getFunctions(true);
        while (funcs.hasNext()) {
            Function f = funcs.next();
            DecompileResults res = decomp.decompileFunction(f, 60, monitor);
            if (res.decompileCompleted() && res.getDecompiledFunction() != null) {
                Address entry = f.getEntryPoint();
                String entryHex = entry.toString();
                
                // Calculate offset relative to ImageBase for PIE matching with nm
                String relHex = "";
                try {
                    long relOffset = entry.subtract(currentProgram.getImageBase());
                    relHex = Long.toHexString(relOffset);
                } catch (Exception e) {}

                System.out.println("=== FUNC_START:" + entryHex + ":" + relHex + ":" + f.getName() + " ===");
                System.out.println(res.getDecompiledFunction().getC());
                System.out.println("=== FUNC_END ===");
            }
        }
        System.out.flush();
    }
}
