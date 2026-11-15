// =====================================================================================================
//  .fab exporter (reverse-engineered from the sample MutationEffectLibrary.fab – NOT the official tool)
//
//  Tools > Universe > Export .fab (Test)
//  Batch:  Unity -batchmode -quit -projectPath <p> -executeMethod UniverseFX.FF.UniverseFabExporter.ExportBatch
//
//  Layout reproduced from the sample:
//    FEPrefabManifest.json             constant
//    Manifest.json                     folder tree of the exported prefabs (UUID = prefab GUID)
//    <pkg>.pck                         protobuf index (package, bundles + hash + size, assets)
//    <pkg>_assets.txt / _bundles.txt / _meta.txt   (CRLF)
//    <Platform>/<pkg>/entry0.ab        prefabs
//    <Platform>/<pkg>/dependencie1.ab  materials, textures, shader
//  Platforms: Android, IOS, PC, WebGL – only the ones whose build module is installed are exported.
//  Bundle hashes / sizes in the index come from the first available of IOS, Android, PC, WebGL
//  (the sample's index matches its IOS bundles).
// =====================================================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace UniverseFX.FF
{
    public static class UniverseFabExporter
    {
        static string PackageName = "universe_effect";
        static string SourceFolder = "Assets/Universe_Effect";
        static string EntryBundle = "universe_effect/entry0.ab";
        static string DepBundle = "universe_effect/dependencie1.ab";
        const string OutputFolder = "Tools/fab_out";   // relative to the project root

        // Builds the prefab(s) in SourceFolder before export. Default = the Universe Aura builder.
        static Action PrepareBuild = () => UniverseAuraFFBuilder.BuildForExport();

        /// <summary>Sets the package name and the folder holding the prefab(s) to export.</summary>
        public static void Configure(string packageName, string sourceFolder, Action prepareBuild)
        {
            PackageName = packageName;
            SourceFolder = sourceFolder;
            EntryBundle = PackageName + "/entry0.ab";
            DepBundle = PackageName + "/dependencie1.ab";
            PrepareBuild = prepareBuild;
        }

        /// <summary>
        /// Batch entry. Optional args:
        ///   -fabSpec <path to effect .json>   build the effect from a JSON spec (EffectSpecBuilder) and export it.
        /// Without -fabSpec it exports the Universe Aura as before.
        /// </summary>
        public static void ExportBatch()
        {
            string spec = ArgValue("-fabSpec");
            if (!string.IsNullOrEmpty(spec))
            {
                FxSpec s = EffectSpecBuilder.Load(spec);
                string name = EffectSpecBuilder.SafeName(s.name);
                Configure(name, "Assets/Effects/" + name, () => EffectSpecBuilder.Build(spec));
            }
            string path = Export();
            EditorApplication.Exit(path != null ? 0 : 1);
        }

        static string ArgValue(string key)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == key) return args[i + 1];
            return null;
        }

        struct Platform
        {
            public string folder;
            public BuildTarget target;
            public BuildTargetGroup group;
            public Platform(string f, BuildTarget t, BuildTargetGroup g) { folder = f; target = t; group = g; }
        }

        // order = preference for the hashes/sizes written into the index
        static readonly Platform[] Platforms =
        {
            new Platform("IOS", BuildTarget.iOS, BuildTargetGroup.iOS),
            new Platform("Android", BuildTarget.Android, BuildTargetGroup.Android),
            new Platform("PC", BuildTarget.StandaloneWindows64, BuildTargetGroup.Standalone),
            new Platform("WebGL", BuildTarget.WebGL, BuildTargetGroup.WebGL),
        };

        [MenuItem("Tools/Universe/Export .fab (Test)", false, 4)]
        static void ExportMenu()
        {
            string path = Export();
            if (path != null) EditorUtility.RevealInFinder(path);
        }

        public static string Export()
        {
            try
            {
                PrepareBuild();
                return ExportFolder();
            }
            catch (Exception e)
            {
                Debug.LogError("[Universe] .fab export failed: " + e);
                return null;
            }
            finally
            {
                EditorUtility.ClearProgressBar();
                // BuildForExport switched the materials to the built-in shader; give URP projects their preview back.
                if (UniverseAuraFFBuilder.UsingSrp())
                    UniverseAuraFFBuilder.SetMaterialsBuiltin(false);
            }
        }

        static string ExportFolder()
        {
            string projectRoot = Path.GetDirectoryName(Application.dataPath);
            string outRoot = Path.Combine(projectRoot, OutputFolder);
            string staging = Path.Combine(outRoot, PackageName);
            string work = Path.Combine(projectRoot, "Temp/UniverseFabBuild");
            if (Directory.Exists(staging)) Directory.Delete(staging, true);
            if (Directory.Exists(work)) Directory.Delete(work, true);
            Directory.CreateDirectory(staging);

            // ---- assets
            string[] prefabs = AssetDatabase.FindAssets("t:Prefab", new[] { SourceFolder })
                .Select(g => AssetDatabase.GUIDToAssetPath(g))
                .Where(p => Path.GetDirectoryName(p).Replace('\\', '/') == SourceFolder)
                .OrderBy(p => p, StringComparer.Ordinal)
                .ToArray();
            if (prefabs.Length == 0) throw new InvalidOperationException("No prefab found in " + SourceFolder);

            foreach (string p in prefabs)
                if (!UniverseFFValidator.Validate(AssetDatabase.LoadAssetAtPath<GameObject>(p)))
                    throw new InvalidOperationException(p + " failed FF validation (see Console).");

            string[] deps = AssetDatabase.GetDependencies(prefabs, true)
                .Where(p => !prefabs.Contains(p) && !p.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
                .OrderBy(p => p, StringComparer.Ordinal)
                .ToArray();

            var builds = new[]
            {
                new AssetBundleBuild { assetBundleName = DepBundle, assetNames = deps },
                new AssetBundleBuild { assetBundleName = EntryBundle, assetNames = prefabs },
            };

            // ---- bundles per platform
            var hashes = new Dictionary<string, string>();
            var sizes = new Dictionary<string, long>();
            var exported = new List<string>();
            var skipped = new List<string>();

            MobileTextureSubtarget oldSub = EditorUserBuildSettings.androidBuildSubtarget;
            try
            {
                EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ETC2; // widest low-end support

                foreach (Platform pf in Platforms)
                {
                    if (!BuildPipeline.IsBuildTargetSupported(pf.group, pf.target))
                    {
                        skipped.Add(pf.folder);
                        continue;
                    }
                    EditorUtility.DisplayProgressBar("Export .fab", "Building bundles: " + pf.folder, 0.3f);
                    string dir = Path.Combine(work, pf.folder);
                    Directory.CreateDirectory(dir);
                    AssetBundleManifest manifest = BuildPipeline.BuildAssetBundles(dir, builds,
                        BuildAssetBundleOptions.ChunkBasedCompression | BuildAssetBundleOptions.StrictMode, pf.target);
                    if (manifest == null) throw new InvalidOperationException("BuildAssetBundles failed for " + pf.folder);

                    string dst = Path.Combine(staging, pf.folder + "/" + PackageName);
                    Directory.CreateDirectory(dst);
                    foreach (string b in new[] { DepBundle, EntryBundle })
                    {
                        string src = Path.Combine(dir, b);
                        string to = Path.Combine(staging, pf.folder + "/" + b);
                        File.Copy(src, to, true);
                        if (!hashes.ContainsKey(b))
                        {
                            hashes[b] = manifest.GetAssetBundleHash(b).ToString();
                            sizes[b] = new FileInfo(src).Length;
                        }
                    }
                    exported.Add(pf.folder);
                }
            }
            finally
            {
                EditorUserBuildSettings.androidBuildSubtarget = oldSub;
            }
            if (exported.Count == 0) throw new InvalidOperationException("No platform build module installed.");

            // ---- index files
            var assets = prefabs.Select(p => new AssetEntry
            {
                guid = AssetDatabase.AssetPathToGUID(p),
                path = p,
                bundle = EntryBundle,
            }).ToList();

            var crlf = new StringBuilder();
            foreach (AssetEntry a in assets) crlf.Append(a.guid).Append("|ABGameObjectRes|").Append(a.path).Append('|').Append(a.bundle).Append("\r\n");
            WriteText(staging, PackageName + "_assets.txt", crlf.ToString());

            crlf.Length = 0;
            crlf.Append(hashes[DepBundle]).Append('|').Append(DepBundle).Append("|0\r\n");
            crlf.Append(hashes[EntryBundle]).Append('|').Append(EntryBundle).Append("|1|").Append(DepBundle).Append("\r\n");
            WriteText(staging, PackageName + "_bundles.txt", crlf.ToString());

            WriteText(staging, PackageName + "_meta.txt",
                "Name:" + PackageName + "\r\nUUID:fab_" + PackageName + "\r\nPackageType:UnityBundle\r\nUseableType:ClientOnly\r\nVersion:1\r\nPlatform:Any\r\n");

            WriteText(staging, "FEPrefabManifest.json",
                "{\"Name\":null,\"UUID\":null,\"Type\":null,\"Version\":0,\"IsFFBuildinRes\":false,\"Children\":null,\"Sprite\":null,\"AnimationClip\":null,\"SubMeshCount\":0}");
            WriteText(staging, "Manifest.json", ManifestJson(assets));
            File.WriteAllBytes(Path.Combine(staging, PackageName + ".pck"), Pck(assets, hashes, sizes));

            // ---- zip -> .fab (same entry order as the sample, with explicit folder entries)
            string fab = Path.Combine(outRoot, PackageName + ".fab");
            if (File.Exists(fab)) File.Delete(fab);
            using (var zip = ZipFile.Open(fab, ZipArchiveMode.Create))
            {
                foreach (string f in new[] { "FEPrefabManifest.json", PackageName + ".pck", PackageName + "_assets.txt",
                                             PackageName + "_bundles.txt", PackageName + "_meta.txt", "Manifest.json" })
                    zip.CreateEntryFromFile(Path.Combine(staging, f), f, System.IO.Compression.CompressionLevel.Optimal);
                foreach (string pf in exported)
                {
                    zip.CreateEntry(pf + "/");
                    zip.CreateEntry(pf + "/" + PackageName + "/");
                    foreach (string b in new[] { DepBundle, EntryBundle })
                        zip.CreateEntryFromFile(Path.Combine(staging, pf + "/" + b), pf + "/" + b, System.IO.Compression.CompressionLevel.Optimal);
                }
            }

            Debug.Log("[Universe] .fab written: " + fab + "\n  platforms: " + string.Join(", ", exported.ToArray()) +
                      (skipped.Count > 0 ? "\n  skipped (build module not installed): " + string.Join(", ", skipped.ToArray()) : "") +
                      "\n  Unity " + Application.unityVersion + " – the sample was built with 2018.4.11f1; older runtimes cannot load newer bundles.");
            return fab;
        }

        class AssetEntry
        {
            public string guid, path, bundle;
        }

        static void WriteText(string dir, string name, string text)
        {
            File.WriteAllBytes(Path.Combine(dir, name), new UTF8Encoding(false).GetBytes(text));
        }

        // ---------------- Manifest.json (folder tree, same key order as the sample)

        class Node
        {
            public string name, uuid, type;
            public int version;
            public List<Node> children;
        }

        static string ManifestJson(List<AssetEntry> assets)
        {
            var root = new Node { name = PackageName, uuid = "fab_" + PackageName, type = "Folder", version = 1, children = new List<Node>() };
            foreach (AssetEntry a in assets)
            {
                string[] parts = a.path.Split('/');
                Node cur = root;
                for (int i = 0; i < parts.Length - 1; i++)
                {
                    Node next = cur.children.FirstOrDefault(c => c.name == parts[i] && c.type == "Folder");
                    if (next == null)
                    {
                        next = new Node { name = parts[i], uuid = "", type = "Folder", children = new List<Node>() };
                        cur.children.Add(next);
                    }
                    cur = next;
                }
                cur.children.Add(new Node { name = parts[parts.Length - 1], uuid = a.guid, type = "ABGameObjectRes" });
            }
            var sb = new StringBuilder();
            WriteNode(sb, root);
            return sb.ToString();
        }

        static void WriteNode(StringBuilder sb, Node n)
        {
            sb.Append("{\"Name\":").Append(JsonString(n.name))
              .Append(",\"UUID\":").Append(JsonString(n.uuid))
              .Append(",\"Type\":").Append(JsonString(n.type))
              .Append(",\"Version\":").Append(n.version)
              .Append(",\"IsFFBuildinRes\":false,\"Children\":");
            if (n.children == null) sb.Append("null");
            else
            {
                sb.Append('[');
                for (int i = 0; i < n.children.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    WriteNode(sb, n.children[i]);
                }
                sb.Append(']');
            }
            sb.Append(",\"Sprite\":null,\"AnimationClip\":null,\"SubMeshCount\":0}");
        }

        static string JsonString(string s)
        {
            return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        }

        // ---------------- .pck (protobuf, field numbers decoded from the sample)

        static byte[] Pck(List<AssetEntry> assets, Dictionary<string, string> hashes, Dictionary<string, long> sizes)
        {
            var bundles = new Pb();
            var dep = new Pb();
            dep.Str(1, DepBundle); dep.Str(2, hashes[DepBundle]); dep.UInt(3, (ulong)sizes[DepBundle]);
            bundles.Msg(1, dep);
            var entry = new Pb();
            entry.Str(1, EntryBundle); entry.Str(2, hashes[EntryBundle]); entry.UInt(3, (ulong)sizes[EntryBundle]); entry.Str(4, DepBundle);
            bundles.Msg(1, entry);

            var pck = new Pb();
            pck.Str(1, PackageName);
            pck.Str(2, "fab_" + PackageName);
            pck.UInt(4, 1);
            pck.Str(7, "1");
            pck.Msg(9, bundles);
            foreach (AssetEntry a in assets)
            {
                var m = new Pb();
                m.Str(1, a.guid);
                m.UInt(2, 15);              // ABGameObjectRes
                m.Str(3, a.path);
                m.Str(4, a.bundle);
                m.UInt(5, 1);               // index of the entry bundle in the bundle list
                pck.Msg(10, m);
            }
            return pck.ToArray();
        }

        class Pb
        {
            readonly MemoryStream ms = new MemoryStream();

            void Varint(ulong v)
            {
                while (v >= 0x80) { ms.WriteByte((byte)(v | 0x80)); v >>= 7; }
                ms.WriteByte((byte)v);
            }

            void Bytes(int field, byte[] b)
            {
                Varint((ulong)(field << 3 | 2));
                Varint((ulong)b.Length);
                ms.Write(b, 0, b.Length);
            }

            public void UInt(int field, ulong v) { Varint((ulong)(field << 3)); Varint(v); }
            public void Str(int field, string s) { Bytes(field, Encoding.UTF8.GetBytes(s)); }
            public void Msg(int field, Pb m) { Bytes(field, m.ToArray()); }
            public byte[] ToArray() { return ms.ToArray(); }
        }
    }
}
