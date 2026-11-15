// =====================================================================================================
//  FF effect validator
//
//  Tools > Universe > Validate FF Effect (Selected Prefab)
//  Checks a prefab against the rules observed in the .fab sample (MutationEffectLibrary, Unity 2018.4.11f1).
//  These are inferred from the sample, NOT official limits – confirm them with the engine team.
//
//  Written for C# 7.3 / Unity 2018.4 API. Copy together with UniverseAuraFFBuilder.cs.
// =====================================================================================================
using System.Collections.Generic;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace UniverseFX.FF
{
    public static class UniverseFFValidator
    {
        const int MaxParticles = 30;
        const int MaxTextureSize = 1024;
        const string ExpectedShader = "Particles/Standard Unlit";
        static readonly string[] TextureProps = { "_MainTex", "_BaseMap", "_EmissionMap", "_BumpMap" };

        [MenuItem("Tools/Universe/Validate FF Effect (Selected Prefab)", false, 3)]
        static void ValidateSelected()
        {
            GameObject go = Selection.activeGameObject;
            if (go == null)
            {
                EditorUtility.DisplayDialog("Validate FF Effect", "Select a prefab (Project window) or a GameObject first.", "OK");
                return;
            }
            Validate(go);
        }

        /// <summary>Logs a report. Returns true when no errors were found (warnings allowed).</summary>
        public static bool Validate(GameObject root)
        {
            if (root == null) return false;

            var errors = new List<string>();
            var warnings = new List<string>();
            int systems = 0, totalParticles = 0;
            var textures = new HashSet<Texture>();
            var materials = new HashSet<Material>();

            foreach (Component c in root.GetComponentsInChildren<Component>(true))
            {
                if (c == null)
                {
                    errors.Add("Missing script on a child of '" + root.name + "' (scripts cannot be exported).");
                    continue;
                }
                if (c is Transform) continue;

                var ps = c as ParticleSystem;
                if (ps != null)
                {
                    systems++;
                    int max = ps.main.maxParticles;
                    totalParticles += max;
                    if (max > MaxParticles)
                        warnings.Add(Path(c.transform, root.transform) + ": Max Particles " + max + " > " + MaxParticles + " (sample never exceeds 30).");
                    continue;
                }

                var r = c as ParticleSystemRenderer;
                if (r != null)
                {
                    foreach (Material m in r.sharedMaterials) if (m != null) materials.Add(m);
                    if (r.trailMaterial != null) materials.Add(r.trailMaterial);
                    if (r.renderMode == ParticleSystemRenderMode.Mesh)
                        warnings.Add(Path(c.transform, root.transform) + ": Mesh render mode (sample only uses billboards).");
                    continue;
                }

                errors.Add(Path(c.transform, root.transform) + ": component '" + c.GetType().Name +
                           "' is not allowed (sample only contains Transform / ParticleSystem / ParticleSystemRenderer).");
            }

            foreach (Material m in materials)
            {
                if (m.shader == null || m.shader.name != ExpectedShader)
                    errors.Add("Material '" + m.name + "' uses shader '" + (m.shader != null ? m.shader.name : "none") +
                               "' – must be '" + ExpectedShader + "' (re-run the builder in the Built-in 2018.4 project).");
                foreach (string prop in TextureProps)
                {
                    if (!m.HasProperty(prop)) continue;
                    Texture t = m.GetTexture(prop);
                    if (t != null) textures.Add(t);
                }
            }

            foreach (Texture t in textures)
                if (t.width > MaxTextureSize || t.height > MaxTextureSize)
                    warnings.Add("Texture '" + t.name + "' is " + t.width + "x" + t.height + " (keep ≤ " + MaxTextureSize + " for low end).");

            var sb = new StringBuilder();
            sb.AppendLine("[Universe] FF validation of '" + root.name + "': " + systems + " particle systems, " +
                          totalParticles + " max particles total, " + materials.Count + " materials, " + textures.Count + " textures.");
            foreach (string e in errors) sb.AppendLine("  ERROR   " + e);
            foreach (string w in warnings) sb.AppendLine("  WARNING " + w);
            if (errors.Count == 0 && warnings.Count == 0) sb.AppendLine("  OK – matches the rules seen in the .fab sample.");

            if (errors.Count > 0) Debug.LogError(sb.ToString(), root);
            else if (warnings.Count > 0) Debug.LogWarning(sb.ToString(), root);
            else Debug.Log(sb.ToString(), root);
            return errors.Count == 0;
        }

        static string Path(Transform t, Transform root)
        {
            string p = t.name;
            while (t != root && t.parent != null)
            {
                t = t.parent;
                p = t.name + "/" + p;
            }
            return p;
        }
    }
}
